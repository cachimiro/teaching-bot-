import { after } from "next/server";
import { z } from "zod";
import { createAdminClient, getUserId } from "@/lib/supabase/server";
import { BLOCK_MESSAGES, chargeCredits, ensureAccess } from "@/lib/credits/service";
import { ttsCostUsd, usdToCredits } from "@/lib/credits/pricing";
import { toSpeech } from "@/lib/voice/speech-text";
import { env } from "@/lib/env";

const Body = z.object({ text: z.string().min(1).max(20_000) });

/** Text → speech via Deepgram Aura-2 (British voice). Returns audio/mpeg. */
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Please sign in again." }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });

  const speech = toSpeech(parsed.data.text);
  if (!speech) return new Response(null, { status: 204 });

  const admin = createAdminClient();
  const access = await ensureAccess(admin, userId);
  if (!access.ok) return Response.json({ error: BLOCK_MESSAGES[access.reason], reason: access.reason }, { status: 402 });

  const res = await fetch(`https://api.deepgram.com/v1/speak?model=${env.deepgramVoice()}&encoding=mp3`, {
    method: "POST",
    headers: { Authorization: `Token ${env.deepgramApiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: speech }),
  });
  if (!res.ok || !res.body) {
    console.error("deepgram speak failed", res.status, await res.text().catch(() => ""));
    return Response.json({ error: "Couldn't play the voice reply." }, { status: 502 });
  }

  // Charge once the audio is on its way, so billing never delays the first sound.
  const credits = usdToCredits(ttsCostUsd(speech.length));
  after(() => chargeCredits(admin, userId, credits, "tts", null, { chars: speech.length }));

  return new Response(res.body, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
}
