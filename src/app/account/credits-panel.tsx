"use client";

import { useActionState, useState } from "react";
import { formatResetTime, publishCredits, type CreditsView } from "@/lib/credits/client";
import { saveTopupSettings, type FormState } from "@/lib/profile-actions";

const CAPS = [500, 1000, 2000, 5000];
const pounds = (pence: number) => `£${(pence / 100).toFixed(pence % 100 ? 2 : 0)}`;

export function CreditsPanel({ initial, pack }: { initial: CreditsView; pack: { pricePence: number; credits: number } }) {
  const [status, setStatus] = useState(initial);
  const [buying, setBuying] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingsState, settingsAction, saving] = useActionState<FormState, FormData>(saveTopupSettings, {});

  const buy = async (packs: number) => {
    setBuying(packs);
    setError(null);
    try {
      const res = await fetch("/api/credits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packs }),
      });
      const body = await res.json();
      if (!res.ok) return setError(body.error);
      setStatus(body);
      publishCredits(body);
    } finally {
      setBuying(null);
    }
  };

  const usedPct = Math.min(100, (status.dailyUsed / status.dailyAllowance) * 100);

  return (
    <div className="mt-4 space-y-6">
      <div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold text-navy">
            {Math.floor(status.dailyRemaining)} of {status.dailyAllowance} left today
          </span>
          <span className="text-muted">Resets at {formatResetTime(status.resetsAt)}</span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-navy-50">
          <div className="h-full rounded-full bg-navy transition-all" style={{ width: `${100 - usedPct}%` }} />
        </div>
        <p className="mt-3 text-sm text-ink">
          Top-up credits: <span className="font-semibold">{Math.floor(Math.max(status.walletBalance, 0))}</span>
          <span className="text-muted"> (used after today&apos;s allowance, never expire)</span>
        </p>
        <p className="mt-1 text-xs text-muted">A typed message usually uses under 1 credit; opening a new topic about 1–2.</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-navy">Top up</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {[1, 2, 4].map((n) => (
            <button
              key={n}
              onClick={() => buy(n)}
              disabled={buying !== null}
              className="rounded-full border border-navy-100 bg-white px-4 py-2 text-sm font-semibold text-navy shadow-sm hover:border-gold disabled:opacity-50"
            >
              {buying === n ? "Adding…" : `${pounds(n * pack.pricePence)} · ${n * pack.credits} credits`}
            </button>
          ))}
        </div>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </div>

      <form action={settingsAction} className="rounded-xl bg-paper p-4">
        <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-navy">
          <input type="checkbox" name="auto_topup" defaultChecked={status.autoTopup} className="h-4 w-4 accent-navy" />
          Auto top-up: add {pack.credits} credits for {pounds(pack.pricePence)} whenever I run out
        </label>
        <label className="mt-3 block text-sm text-ink">
          Never auto top-up more than{" "}
          <select
            name="monthly_topup_cap_pence"
            defaultValue={CAPS.includes(status.monthlyCapPence) ? status.monthlyCapPence : 2000}
            className="rounded-lg border border-navy-100 bg-white px-2 py-1"
          >
            {CAPS.map((c) => (
              <option key={c} value={c}>
                {pounds(c)}
              </option>
            ))}
          </select>{" "}
          a month <span className="text-muted">({pounds(status.autoSpentPence)} used this month)</span>
        </label>
        <div className="mt-3 flex items-center gap-3">
          <button
            disabled={saving}
            className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-600 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {settingsState.saved && <span className="text-sm text-navy">Saved.</span>}
          {settingsState.error && <span className="text-sm text-red-700">{settingsState.error}</span>}
        </div>
      </form>
    </div>
  );
}
