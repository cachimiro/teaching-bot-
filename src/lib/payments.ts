import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { PLAN } from "@/lib/credits/pricing";

export type TopupResult = { ok: true; balance: number } | { ok: false; error: string };

/**
 * Buys top-up packs. In "simulated" mode (until Stripe is connected) the credits are granted
 * without charging a card, so the whole flow can be tested end to end.
 */
export async function purchaseTopup(
  admin: SupabaseClient,
  userId: string,
  packs: number,
  source: "auto" | "manual",
): Promise<TopupResult> {
  if (!Number.isInteger(packs) || packs < 1 || packs > 10) return { ok: false, error: "Choose between 1 and 10 packs." };

  if (env.paymentsMode() !== "simulated") {
    // Stripe phase: charge the saved card off-session here, then grant on success.
    return { ok: false, error: "Card payments are not set up yet." };
  }

  const { data, error } = await admin.rpc("grant_topup", {
    p_user: userId,
    p_source: source,
    p_packs: packs,
    p_amount_pence: packs * PLAN.topupPack.pricePence,
    p_credits: packs * PLAN.topupPack.credits,
    p_payment_ref: `simulated_${crypto.randomUUID()}`,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, balance: Number(data) };
}
