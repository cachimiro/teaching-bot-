"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CREDITS_EVENT, CREDITS_STALE_EVENT, type CreditsView } from "@/lib/credits/client";

/** Header pill showing today's remaining credits; updates live after each message and voice charge. */
export function CreditPill() {
  const [status, setStatus] = useState<CreditsView | null>(null);

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const refresh = () =>
      fetch("/api/credits")
        .then((r) => (r.ok ? r.json() : null))
        .then((s) => s && setStatus(s))
        .catch(() => {});
    void refresh();
    const onUpdate = (e: Event) => setStatus((e as CustomEvent<CreditsView>).detail);
    const onStale = () => {
      clearTimeout(debounce);
      debounce = setTimeout(refresh, 1500);
    };
    window.addEventListener(CREDITS_EVENT, onUpdate);
    window.addEventListener(CREDITS_STALE_EVENT, onStale);
    return () => {
      clearTimeout(debounce);
      window.removeEventListener(CREDITS_EVENT, onUpdate);
      window.removeEventListener(CREDITS_STALE_EVENT, onStale);
    };
  }, []);

  if (!status) return null;
  const today = Math.floor(status.dailyRemaining);
  const wallet = Math.floor(Math.max(status.walletBalance, 0));
  const low = today + wallet < 5;
  return (
    <Link
      href="/account"
      title="Study credits: your daily allowance resets at midnight"
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
        low ? "border-gold bg-gold-50 text-gold-700" : "border-navy-100 bg-paper text-navy"
      }`}
    >
      {today}/{status.dailyAllowance} today{wallet > 0 ? ` · +${wallet}` : ""}
    </Link>
  );
}
