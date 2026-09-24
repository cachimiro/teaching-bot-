import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createAdminClient, getUserId } from "@/lib/supabase/server";
import { BLOCK_MESSAGES, chargeCredits, ensureAccess, getCreditStatus } from "@/lib/credits/service";
import { claudeCostUsd, usdToCredits } from "@/lib/credits/pricing";
import { buildSystem } from "@/lib/tutor/prompt";
import { assistantTexts, runTutorTurn } from "@/lib/tutor/turn";
import { latestLessonStage } from "@/lib/tutor/activities";
import {
  createConversation,
  getConversation,
  getLearnerProfile,
  getSubjectSetting,
  getTopicById,
  getTopicSketches,
  loadHistory,
  saveLearnerNotes,
  saveMessages,
} from "@/lib/tutor/data";

export const maxDuration = 120;

const Body = z.object({
  topicId: z.string().min(1).max(20),
  mode: z.enum(["learn", "quiz", "mock"]),
  conversationId: z.uuid().nullish(),
  message: z.string().trim().min(1).max(4000),
  voice: z.boolean().default(false),
});

const anthropic = new Anthropic();

/** Streams one tutor turn as NDJSON: start → text* → done | error. */
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Please sign in again." }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const body = parsed.data;

  const admin = createAdminClient();
  // Independent lookups run together: each is a database round trip.
  const [access, topic, existing, existingHistory, profile, sketches] = await Promise.all([
    ensureAccess(admin, userId),
    getTopicById(admin, body.topicId),
    body.conversationId ? getConversation(admin, userId, body.conversationId) : null,
    body.conversationId ? loadHistory(admin, body.conversationId) : [],
    getLearnerProfile(admin, userId),
    // A nice-to-have: never let it block a reply.
    getTopicSketches(admin, body.topicId).catch(() => []),
  ]);
  if (!access.ok) {
    return Response.json(
      { error: BLOCK_MESSAGES[access.reason], reason: access.reason, resetsAt: access.resetsAt },
      { status: 402 },
    );
  }
  if (!topic) return Response.json({ error: "Topic not found." }, { status: 404 });
  if (body.conversationId && (!existing || existing.topicId !== topic.id)) {
    return Response.json({ error: "Conversation not found." }, { status: 404 });
  }

  let conversation = existing;
  if (!conversation) {
    const setting = await getSubjectSetting(admin, userId, topic.subject);
    if (!setting) return Response.json({ error: "Choose your exam board and tier first.", reason: "setup_required" }, { status: 400 });
    conversation = { ...(await createConversation(admin, userId, topic.id, body.mode, setting)), topicId: topic.id };
  }

  const learner = { ...profile, examBoard: conversation.examBoard, tier: conversation.tier };
  const history = existing ? existingHistory : [];
  const lesson = conversation.mode === "learn" ? latestLessonStage(assistantTexts(history)) : null;
  const system = buildSystem(topic, learner, conversation.mode, body.voice, { sketches, lesson });
  const conversationId = conversation.id;
  const mode = conversation.mode;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      send({ type: "start", conversationId });
      let result: Awaited<ReturnType<typeof runTutorTurn>>;
      try {
        result = await runTutorTurn({
          client: anthropic,
          system,
          history,
          userText: body.message,
          mode,
          onText: (delta) => send({ type: "text", delta }),
          signal: request.signal,
        });
      } catch (err) {
        console.error("chat turn failed", err);
        const busy = err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError;
        send({
          type: "error",
          error: busy
            ? "The tutor is very busy right now. Please try again in a moment (you weren't charged)."
            : "Something went wrong. Please try again (you weren't charged).",
        });
        controller.close();
        return;
      }

      // Finish the reply first (so the last sentence can be spoken straight away), then do the bookkeeping.
      send({ type: "done", text: result.text });
      try {
        const credits = usdToCredits(claudeCostUsd(result.usage));
        await Promise.all([
          saveMessages(admin, conversationId, userId, result.newMessages),
          chargeCredits(admin, userId, credits, "chat", conversationId, { ...result.usage, stop: result.stopReason }),
          saveLearnerNotes(admin, userId, topic.id, result.notes),
        ]);
        send({ type: "status", credits, status: await getCreditStatus(admin, userId) });
      } catch (err) {
        console.error("saving chat turn failed", err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
