import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { chargeCredits } from "@/lib/credits/service";
import { sttCostUsd, usdToCredits } from "@/lib/credits/pricing";
import { billableSeconds } from "./billing";

/** Deepgram live transcription settings shared by every listening session. */
const LIVE_PARAMS = {
  model: "nova-3",
  language: "en-GB",
  smart_format: "true",
  interim_results: "true",
  endpointing: "300",
  utterance_end_ms: "1000",
  vad_events: "true",
  encoding: "linear16",
  sample_rate: "16000",
};

export function liveUrl(keyterms: string[]) {
  const params = new URLSearchParams(LIVE_PARAMS);
  for (const term of keyterms) params.append("keyterm", term);
  return `wss://api.deepgram.com/v1/listen?${params}`;
}

/** A 30-second token the browser uses to open its own WebSocket to Deepgram. */
export async function grantBrowserToken(): Promise<string | null> {
  const res = await fetch("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: { Authorization: `Token ${env.deepgramApiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ttl_seconds: 30 }),
  });
  if (!res.ok) {
    console.error("deepgram grant failed", res.status, await res.text());
    return null;
  }
  const json = (await res.json()) as { access_token?: string };
  return json.access_token ?? null;
}

/** Closes a listening session and charges for the mic time (server-capped). Safe to call twice. */
export async function endSession(admin: SupabaseClient, userId: string, sessionId: string, reported: number | null) {
  const { data: session } = await admin
    .from("voice_sessions")
    .select("id, started_at")
    .match({ id: sessionId, user_id: userId })
    .is("ended_at", null)
    .maybeSingle();
  if (!session) return 0;

  const seconds = billableSeconds(reported, new Date(session.started_at), new Date());
  const { data: closed } = await admin
    .from("voice_sessions")
    .update({ ended_at: new Date().toISOString(), seconds })
    .match({ id: sessionId })
    .is("ended_at", null)
    .select("id");
  if (!closed?.length) return 0; // another request closed it first

  const credits = usdToCredits(sttCostUsd(seconds));
  await chargeCredits(admin, userId, credits, "stt", null, { seconds, live: true });
  return credits;
}

/** Bills any sessions the browser never closed (tab closed mid-listen). */
export async function endAbandonedSessions(admin: SupabaseClient, userId: string) {
  const { data } = await admin.from("voice_sessions").select("id").eq("user_id", userId).is("ended_at", null);
  for (const s of data ?? []) await endSession(admin, userId, s.id, null);
}
