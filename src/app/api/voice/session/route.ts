import { z } from "zod";
import { createAdminClient, getUserId } from "@/lib/supabase/server";
import { BLOCK_MESSAGES, ensureAccess } from "@/lib/credits/service";
import { getTopicById } from "@/lib/tutor/data";
import { topicKeyterms } from "@/lib/voice/keyterms";
import { endAbandonedSessions, grantBrowserToken, liveUrl } from "@/lib/voice/sessions";

const Start = z.object({ topicId: z.string().min(1).max(20) });

/** Starts live listening: returns a short-lived Deepgram token and the WebSocket URL to use. */
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Please sign in again." }, { status: 401 });
  const parsed = Start.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });

  const admin = createAdminClient();
  // Independent lookups run together so the mic opens as fast as possible.
  const [, access, topic, token] = await Promise.all([
    endAbandonedSessions(admin, userId),
    ensureAccess(admin, userId),
    getTopicById(admin, parsed.data.topicId),
    grantBrowserToken(),
  ]);
  if (!access.ok) {
    return Response.json({ error: BLOCK_MESSAGES[access.reason], reason: access.reason, resetsAt: access.resetsAt }, { status: 402 });
  }
  if (!token) return Response.json({ error: "Voice isn't available right now. Please type instead." }, { status: 503 });

  const { data: session, error } = await admin.from("voice_sessions").insert({ user_id: userId }).select("id").single();
  if (error) return Response.json({ error: "Voice isn't available right now. Please type instead." }, { status: 500 });

  return Response.json({
    sessionId: session.id,
    token,
    url: liveUrl(topic ? topicKeyterms(topic) : []),
  });
}
