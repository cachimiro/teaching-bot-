import { z } from "zod";
import { createAdminClient, getUserId } from "@/lib/supabase/server";
import { endSession } from "@/lib/voice/sessions";

const End = z.object({ sessionId: z.uuid(), seconds: z.number().min(0).max(3600).nullable() });

/** Ends live listening and charges for the mic time. POST so navigator.sendBeacon can call it on page exit. */
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Please sign in again." }, { status: 401 });
  const parsed = End.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });

  const credits = await endSession(createAdminClient(), userId, parsed.data.sessionId, parsed.data.seconds);
  return Response.json({ credits });
}
