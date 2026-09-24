import { PLAN } from "./pricing";

/** A message costs roughly 1–3 credits; below this we treat the student as out of credits. */
export const MIN_CREDITS_TO_SEND = 1;

export type CreditStatus = {
  dailyUsed: number;
  walletBalance: number;
  autoTopup: boolean;
  monthlyCapPence: number;
  autoSpentPence: number;
  subscriptionStatus: "active" | "inactive";
};

export type BlockReason = "no_subscription" | "daily_limit" | "topup_cap_reached";

export type Access =
  | { ok: true; dailyRemaining: number; walletBalance: number; autoTopupPacks: number }
  | { ok: false; reason: BlockReason };

/**
 * Decides whether the student may send another message, and whether an auto top-up
 * pack must be bought first. The actual charge happens after the call, from real usage,
 * so a message may overdraw the wallet by at most its own cost.
 */
export function decideAccess(s: CreditStatus): Access {
  if (s.subscriptionStatus !== "active") return { ok: false, reason: "no_subscription" };

  const dailyRemaining = Math.max(PLAN.dailyCredits - s.dailyUsed, 0);
  const available = dailyRemaining + Math.max(s.walletBalance, 0);
  if (available >= MIN_CREDITS_TO_SEND) {
    return { ok: true, dailyRemaining, walletBalance: s.walletBalance, autoTopupPacks: 0 };
  }

  if (!s.autoTopup) return { ok: false, reason: "daily_limit" };

  const { credits, pricePence } = PLAN.topupPack;
  const packs = Math.ceil((MIN_CREDITS_TO_SEND - dailyRemaining - s.walletBalance) / credits);
  if (s.autoSpentPence + packs * pricePence > s.monthlyCapPence) return { ok: false, reason: "topup_cap_reached" };

  return { ok: true, dailyRemaining, walletBalance: s.walletBalance, autoTopupPacks: packs };
}
