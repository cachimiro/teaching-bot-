/** Shape of GET /api/credits, safe to use in client components. */
export type CreditsView = {
  dailyUsed: number;
  dailyRemaining: number;
  dailyAllowance: number;
  walletBalance: number;
  autoTopup: boolean;
  monthlyCapPence: number;
  autoSpentPence: number;
  resetsAt: string;
};

export const CREDITS_EVENT = "virtus:credits";

export function publishCredits(status: CreditsView) {
  window.dispatchEvent(new CustomEvent(CREDITS_EVENT, { detail: status }));
}

export const CREDITS_STALE_EVENT = "virtus:credits-stale";

/** Something was charged outside a chat reply (voice); ask the header pill to refresh. */
export function markCreditsStale() {
  window.dispatchEvent(new Event(CREDITS_STALE_EVENT));
}

export function formatResetTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}
