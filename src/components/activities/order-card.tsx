"use client";

import { useMemo, useState } from "react";
import { InlineMaths } from "@/components/inline-maths";
import { activityMessages, scrambled, type OrderSpec } from "@/lib/tutor/activities";

/** Put the steps of a process in order: drag (desktop) or use the arrows (any device), then check. */
export function OrderCard({ spec, interactive, onDone }: { spec: OrderSpec; interactive: boolean; onDone?: (message: string) => void }) {
  const start = useMemo(() => scrambled(spec.items), [spec.items]);
  const [order, setOrder] = useState(interactive ? start : spec.items);
  const [checked, setChecked] = useState(!interactive);
  const [dragging, setDragging] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    if (checked || to < 0 || to >= order.length || from === to) return;
    setOrder((o) => {
      const next = [...o];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const check = () => {
    setChecked(true);
    onDone?.(activityMessages.order(spec, order));
  };

  const allRight = order.every((item, i) => item === spec.items[i]);

  return (
    <div className="my-3 rounded-xl border border-navy-100 bg-white p-4" role="group" aria-label="Put in order">
      <p className="text-xs font-bold uppercase tracking-wide text-gold-700">Put in order</p>
      <p className="mt-1 font-semibold text-navy">
        <InlineMaths text={spec.prompt} />
      </p>
      <ol className="mt-3 space-y-2">
        {order.map((item, i) => {
          const right = checked && item === spec.items[i];
          const wrong = checked && !right;
          return (
            <li
              key={item}
              draggable={!checked}
              onDragStart={() => setDragging(i)}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragging !== null && dragging !== i) {
                  move(dragging, i);
                  setDragging(i);
                }
              }}
              onDragEnd={() => setDragging(null)}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                right ? "border-green-600 bg-green-50" : wrong ? "border-red-500 bg-red-50" : "border-navy-100 bg-paper"
              } ${!checked ? "cursor-grab" : ""} ${dragging === i ? "opacity-60" : ""}`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                {i + 1}
              </span>
              <span className="flex-1">
                <InlineMaths text={item} />
              </span>
              {!checked ? (
                <span className="flex gap-1">
                  <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move "${item}" up`} className="rounded px-2 py-0.5 text-navy hover:bg-white disabled:opacity-30">
                    ▲
                  </button>
                  <button type="button" onClick={() => move(i, i + 1)} disabled={i === order.length - 1} aria-label={`Move "${item}" down`} className="rounded px-2 py-0.5 text-navy hover:bg-white disabled:opacity-30">
                    ▼
                  </button>
                </span>
              ) : (
                <span className={`text-sm font-bold ${right ? "text-green-700" : "text-red-600"}`}>{right ? "✓" : "✗"}</span>
              )}
            </li>
          );
        })}
      </ol>
      {!checked ? (
        <button type="button" onClick={check} className="mt-3 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-600">
          Check my order
        </button>
      ) : (
        interactive &&
        !allRight && (
          <p className="mt-3 text-sm text-ink">
            <strong>Correct order: </strong>
            {spec.items.map((item, i) => (
              <span key={i}>
                {i > 0 && " → "}
                <InlineMaths text={item} />
              </span>
            ))}
          </p>
        )
      )}
      {checked && interactive && allRight && <p className="mt-3 text-sm font-semibold text-green-700">All in the right order.</p>}
    </div>
  );
}
