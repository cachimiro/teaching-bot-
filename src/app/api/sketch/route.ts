import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { createAdminClient, getUserId } from "@/lib/supabase/server";
import { BLOCK_MESSAGES, chargeCredits, ensureAccess } from "@/lib/credits/service";
import { claudeCostUsd, SKETCH_MODEL, usdToCredits, type ClaudeUsage } from "@/lib/credits/pricing";
import { drawSketch, isSafeSvg, sketchKey } from "@/lib/sketch/sketch";
import { parseSketchSpec, type SketchSpec } from "@/lib/sketch/spec";

export const maxDuration = 120;

const anthropic = new Anthropic();

type Drawn = { svg: string | null; usage: ClaudeUsage };

/** Drawings being generated right now, so a second request for the same one waits instead of paying again. */
const inflight = new Map<string, Promise<Drawn>>();

async function draw(admin: SupabaseClient, key: string, spec: SketchSpec, topicId: string | null): Promise<Drawn> {
  const { svg, usage } = await drawSketch(anthropic, spec);
  if (!svg || !isSafeSvg(svg)) return { svg: null, usage };
  const describe = [spec.labels.join("; "), spec.detail].filter(Boolean).join(" | ");
  const row = { key, title: spec.title, describe, svg, spec, topic_id: topicId };
  const { error } = await admin.from("sketches").upsert(row, { onConflict: "key", ignoreDuplicates: true });
  // An unknown topic id shouldn't lose the drawing: store it without one.
  if (error && topicId) await admin.from("sketches").upsert({ ...row, topic_id: null }, { onConflict: "key", ignoreDuplicates: true });
  return { svg, usage };
}

/**
 * Returns the SVG for a tutor-requested sketch. Each distinct description is drawn once, checked,
 * stored and then served free to every student; only the first request pays for the drawing.
 */
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Please sign in again." }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const spec = parseSketchSpec(body);
  if (!spec) return Response.json({ error: "Invalid request." }, { status: 400 });
  const rawTopic = (body as { topicId?: unknown }).topicId;
  const topicId = typeof rawTopic === "string" && /^[A-Z]{1,3}\d{1,4}$/.test(rawTopic) ? rawTopic : null;
  const key = sketchKey(spec);
  const failed = () => Response.json({ error: "Couldn't draw that one." }, { status: 502 });

  const admin = createAdminClient();
  const { data: cached } = await admin.from("sketches").select("svg, uses").eq("key", key).maybeSingle();
  if (cached) {
    after(() => admin.from("sketches").update({ uses: cached.uses + 1 }).eq("key", key));
    return Response.json({ svg: cached.svg, cached: true });
  }

  const pending = inflight.get(key);
  if (pending) {
    const { svg } = await pending.catch(() => ({ svg: null }));
    return svg ? Response.json({ svg, cached: true }) : failed();
  }

  const access = await ensureAccess(admin, userId);
  if (!access.ok) return Response.json({ error: BLOCK_MESSAGES[access.reason], reason: access.reason }, { status: 402 });

  const job = draw(admin, key, spec, topicId);
  inflight.set(key, job);
  let drawn: Drawn;
  try {
    drawn = await job;
  } catch (error) {
    console.error("sketch failed", error);
    return failed();
  } finally {
    inflight.delete(key);
  }

  const credits = usdToCredits(claudeCostUsd(drawn.usage, SKETCH_MODEL));
  after(() => chargeCredits(admin, userId, credits, "chat", null, { sketch: key }));
  return drawn.svg ? Response.json({ svg: drawn.svg, cached: false }) : failed();
}
