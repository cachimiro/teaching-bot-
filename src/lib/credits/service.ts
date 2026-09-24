import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decideAccess, type Access, type CreditStatus } from "./access";
import { londonDay, londonMonthStart, nextLondonMidnight } from "./day";
import { PLAN } from "./pricing";
import { purchaseTopup } from "@/lib/payments";

export type CreditSnapshot = CreditStatus & { dailyRemaining: number; resetsAt: string; dailyAllowance: number };

export async function getCreditStatus(admin: SupabaseClient, userId: string, now = new Date()): Promise<CreditSnapshot> {
  const { data, error } = await admin
    .rpc("credit_status", {
      p_user: userId,
      p_day: londonDay(now),
      p_month_start: londonMonthStart(now).toISOString(),
    })
    .single<{
      daily_used: number;
      wallet_balance: number;
      auto_topup: boolean;
      monthly_cap_pence: number;
      auto_spent_pence: number;
      subscription_status: "active" | "inactive";
    }>();
  if (error) throw error;
  const dailyUsed = Number(data.daily_used);
  return {
    dailyUsed,
    walletBalance: Number(data.wallet_balance),
    autoTopup: data.auto_topup,
    monthlyCapPence: data.monthly_cap_pence,
    autoSpentPence: data.auto_spent_pence,
    subscriptionStatus: data.subscription_status,
    dailyRemaining: Math.max(PLAN.dailyCredits - dailyUsed, 0),
    dailyAllowance: PLAN.dailyCredits,
    resetsAt: nextLondonMidnight(now).toISOString(),
  };
}

/** Checks the student can spend credits, buying auto top-up packs first when needed. */
export async function ensureAccess(admin: SupabaseClient, userId: string): Promise<Access & { resetsAt: string }> {
  const status = await getCreditStatus(admin, userId);
  const access = decideAccess(status);
  if (access.ok && access.autoTopupPacks > 0) {
    const bought = await purchaseTopup(admin, userId, access.autoTopupPacks, "auto");
    if (!bought.ok) return { ok: false, reason: "daily_limit", resetsAt: status.resetsAt };
  }
  return { ...access, resetsAt: status.resetsAt };
}

/** Deducts actual usage: today's allowance first, then top-up credits. */
export async function chargeCredits(
  admin: SupabaseClient,
  userId: string,
  credits: number,
  kind: "chat" | "stt" | "tts",
  conversationId: string | null,
  detail: Record<string, unknown>,
) {
  const { error } = await admin.rpc("consume_credits", {
    p_user: userId,
    p_day: londonDay(),
    p_daily_allowance: PLAN.dailyCredits,
    p_credits: Math.round(credits * 10_000) / 10_000,
    p_kind: kind,
    p_conversation: conversationId,
    p_detail: detail,
  });
  if (error) throw error;
}

export const BLOCK_MESSAGES = {
  daily_limit: "You've used today's study credits. They reset at midnight, or you can top up to keep going.",
  topup_cap_reached: "You've reached this month's auto top-up limit. Credits reset at midnight, or change the limit in your account.",
  no_subscription: "Your subscription isn't active. Please renew it to keep learning.",
} as const;
