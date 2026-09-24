import { z } from "zod";
import { createAdminClient, getUserId } from "@/lib/supabase/server";
import { getCreditStatus } from "@/lib/credits/service";
import { purchaseTopup } from "@/lib/payments";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Please sign in again." }, { status: 401 });
  return Response.json(await getCreditStatus(createAdminClient(), userId));
}

const TopupBody = z.object({ packs: z.number().int().min(1).max(10) });

/** Manual top-up: buys N × £5 packs. */
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Please sign in again." }, { status: 401 });
  const parsed = TopupBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Choose between 1 and 10 packs." }, { status: 400 });

  const admin = createAdminClient();
  const result = await purchaseTopup(admin, userId, parsed.data.packs, "manual");
  if (!result.ok) return Response.json({ error: result.error }, { status: 402 });
  return Response.json(await getCreditStatus(admin, userId));
}
