"use client";

import { useEffect, useRef, useState } from "react";
import { InlineMaths, tex } from "@/components/inline-maths";
import { activityMessages, boxGaps, checkGap, gapsInsideBraces, hasGaps, parseGaps } from "@/lib/tutor/activities";
import { looksLikeMaths, type Step } from "@/lib/voice/speech-plan";

type GapState = { value: string; correct: boolean | null };

function GapInput({
  index,
  answer,
  state,
  setGap,
  checked,
  numbered,
}: {
  index: number;
  answer: string;
  state: GapState | undefined;
  setGap: (i: number, value: string) => void;
  checked: boolean;
  numbered?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {numbered && <span className="text-sm font-semibold text-muted">{index + 1}</span>}
      <input
        value={state?.value ?? ""}
        onChange={(e) => setGap(index, e.target.value)}
        disabled={checked}
        aria-label={`Blank ${index + 1}`}
        size={Math.max(3, answer.length + 1)}
        className={`rounded border px-1.5 py-0.5 text-center text-base font-semibold text-navy focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 ${
          state?.correct === true ? "border-green-600 bg-green-50" : state?.correct === false ? "border-red-500 bg-red-50" : "border-gold bg-gold-50"
        }`}
      />
      {state?.correct === false && <span className="text-sm font-semibold text-green-700">{answer}</span>}
    </span>
  );
}

/** Renders one line of working: KaTeX for maths, plain text for words, answer boxes for [[gaps]]. */
function Line({
  text,
  gaps,
  firstGap,
  setGap,
  checked,
  reveal,
}: {
  text: string;
  gaps: Record<number, GapState>;
  firstGap: number;
  setGap: (i: number, value: string) => void;
  checked: boolean;
  reveal: boolean;
}) {
  const maths = looksLikeMaths(text.replace(/\[\[[^\]]+\]\]/g, "1"));

  // A gap inside a fraction or root can't sit in the line itself: number it there, answer below.
  if (maths && gapsInsideBraces(text)) {
    const answers = parseGaps(text).flatMap((p) => ("answers" in p ? [p.answers[0]] : []));
    return (
      <span className="flex flex-col gap-1.5">
        <span className="overflow-x-auto overflow-y-hidden py-0.5 text-[1.05rem] text-navy" dangerouslySetInnerHTML={{ __html: tex(boxGaps(text, firstGap, reveal)) }} />
        {!reveal && (
          <span className="flex flex-wrap items-center gap-3">
            {answers.map((answer, k) => (
              <GapInput key={k} index={firstGap + k} answer={answer} state={gaps[firstGap + k]} setGap={setGap} checked={checked} numbered />
            ))}
          </span>
        )}
      </span>
    );
  }

  let gapIndex = firstGap;
  return (
    <span className="flex flex-wrap items-center gap-x-1 overflow-x-auto overflow-y-hidden py-0.5 text-[1.05rem] text-navy">
      {parseGaps(text).map((piece, i) => {
        if ("text" in piece) {
          return maths ? (
            <span key={i} dangerouslySetInnerHTML={{ __html: tex(piece.text) }} />
          ) : (
            <span key={i} className="font-medium">
              {piece.text}
            </span>
          );
        }
        const g = gapIndex++;
        const state = gaps[g];
        if (reveal) {
          return (
            <span key={i} className="rounded border border-navy-100 bg-white px-1.5 font-semibold text-navy">
              {piece.answers[0]}
            </span>
          );
        }
        return <GapInput key={i} index={g} answer={piece.answers[0]} state={state} setGap={setGap} checked={checked} />;
      })}
    </span>
  );
}

/**
 * A whiteboard of worked steps: maths on the left, what the tutor says about it on the right.
 * While the tutor is narrating, the step being spoken is highlighted and later steps are dimmed.
 * Lines with [[answer]] gaps become answer boxes the student fills in and checks.
 */
export function StepsBoard({
  steps,
  active,
  narrating,
  interactive = false,
  onDone,
}: {
  steps: Step[];
  active: number | null;
  narrating: boolean;
  interactive?: boolean;
  onDone?: (message: string) => void;
}) {
  const activeRow = useRef<HTMLLIElement>(null);
  const gapAnswers = steps.flatMap((s) => parseGaps(s.math).flatMap((p) => ("answers" in p ? [p.answers] : [])));
  const [gaps, setGaps] = useState<Record<number, GapState>>({});
  const [checked, setChecked] = useState(false);
  // In an older reply (no longer answerable) show the answers, unless the student already checked theirs.
  const reveal = !interactive && !checked && gapAnswers.length > 0;

  useEffect(() => {
    if (narrating && active !== null) activeRow.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [active, narrating]);

  const setGap = (i: number, value: string) => setGaps((g) => ({ ...g, [i]: { value, correct: null } }));

  const check = () => {
    const results = gapAnswers.map((answers, i) => ({
      given: gaps[i]?.value.trim() ?? "",
      correct: checkGap(gaps[i]?.value ?? "", answers),
      answer: answers[0],
    }));
    setGaps(Object.fromEntries(results.map((r, i) => [i, { value: r.given, correct: r.correct }])));
    setChecked(true);
    onDone?.(activityMessages.gaps(results));
  };

  // Index of each line's first gap, so answers can be stored by gap number.
  const gapCounts = steps.map((s) => parseGaps(s.math).filter((p) => "answers" in p).length);
  const firstGaps = gapCounts.map((_, i) => gapCounts.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <div className="my-3">
      <ol className="overflow-hidden rounded-xl border border-navy-100 bg-paper/60" aria-label="Worked steps">
        {steps.map((step, i) => {
          const isActive = active === i;
          const isLater = narrating && active !== null && i > active;
          const firstGap = firstGaps[i];
          return (
            <li
              key={i}
              ref={isActive ? activeRow : undefined}
              aria-current={isActive ? "step" : undefined}
              className={`grid grid-cols-[1.75rem_1fr] gap-x-3 border-l-4 px-3 py-2.5 transition-all duration-300 sm:grid-cols-[1.75rem_minmax(0,1.1fr)_minmax(0,1fr)] ${
                isActive ? "border-gold bg-gold-50" : "border-transparent"
              } ${isLater ? "opacity-35" : "opacity-100"} ${i > 0 ? "border-t border-t-navy-50" : ""}`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  isActive ? "bg-gold text-navy" : "bg-navy text-white"
                }`}
              >
                {i + 1}
              </span>
              {hasGaps(step.math) ? (
                <Line text={step.math} gaps={gaps} firstGap={firstGap} setGap={setGap} checked={checked} reveal={reveal} />
              ) : looksLikeMaths(step.math) ? (
                <span className="overflow-x-auto overflow-y-hidden py-0.5 text-[1.05rem] text-navy" dangerouslySetInnerHTML={{ __html: tex(step.math) }} />
              ) : (
                <span className="text-[1.05rem] font-medium text-navy">{step.math}</span>
              )}
              {step.note && (
                <span className="col-start-2 text-sm text-muted sm:col-start-3 sm:self-center">
                  <InlineMaths text={step.note} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {interactive && gapAnswers.length > 0 && !checked && (
        <button
          type="button"
          onClick={check}
          disabled={gapAnswers.some((_, i) => !gaps[i]?.value.trim())}
          className="mt-2 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-600 disabled:opacity-40"
        >
          Check my answers
        </button>
      )}
    </div>
  );
}
