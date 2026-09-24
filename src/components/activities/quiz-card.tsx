"use client";

import { useState } from "react";
import { InlineMaths } from "@/components/inline-maths";
import { activityMessages, type QuizSpec } from "@/lib/tutor/activities";

const LETTERS = ["A", "B", "C", "D", "E"];

/** Multiple-choice quick check: instant feedback, then the result goes to the tutor. */
export function QuizCard({ spec, interactive, onDone }: { spec: QuizSpec; interactive: boolean; onDone?: (message: string) => void }) {
  const [chosen, setChosen] = useState<number | null>(null);
  const revealed = chosen !== null || !interactive;

  const choose = (i: number) => {
    if (revealed) return;
    setChosen(i);
    onDone?.(activityMessages.quiz(spec, i));
  };

  return (
    <div className="my-3 rounded-xl border border-navy-100 bg-white p-4" role="group" aria-label="Quick check">
      <p className="text-xs font-bold uppercase tracking-wide text-gold-700">Quick check</p>
      <p className="mt-1 font-semibold text-navy">
        <InlineMaths text={spec.question} />
      </p>
      <div className="mt-3 grid gap-2">
        {spec.options.map((option, i) => {
          const isAnswer = i === spec.answer;
          const isChosen = i === chosen;
          const state = !revealed ? "idle" : isAnswer ? "right" : isChosen ? "wrong" : "muted";
          return (
            <button
              key={i}
              type="button"
              disabled={revealed}
              onClick={() => choose(i)}
              aria-pressed={isChosen}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                state === "idle"
                  ? "border-navy-100 bg-white hover:border-gold hover:bg-gold-50"
                  : state === "right"
                    ? "border-green-600 bg-green-50 text-green-900"
                    : state === "wrong"
                      ? "border-red-500 bg-red-50 text-red-900"
                      : "border-navy-50 bg-white text-muted"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  state === "right" ? "bg-green-600 text-white" : state === "wrong" ? "bg-red-500 text-white" : "bg-navy-50 text-navy"
                }`}
              >
                {state === "right" ? "✓" : state === "wrong" ? "✗" : LETTERS[i]}
              </span>
              <span>
                <InlineMaths text={option} />
              </span>
            </button>
          );
        })}
      </div>
      {revealed && (
        <p className="mt-3 text-sm text-ink">
          {chosen !== null && (chosen === spec.answer ? <strong className="text-green-700">Correct. </strong> : <strong className="text-red-700">Not quite. </strong>)}
          {spec.explain && <InlineMaths text={spec.explain} />}
        </p>
      )}
    </div>
  );
}
