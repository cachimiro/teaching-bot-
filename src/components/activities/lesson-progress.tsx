"use client";

import { LESSON_STAGES } from "@/lib/tutor/activities";

/** A small lesson progress bar: Why it matters → Explain → Quick check → Worked example → Your turn → Recap. */
export function LessonProgress({ index }: { index: number }) {
  return (
    <nav aria-label="Lesson progress" className="mb-3 rounded-xl bg-paper px-3 py-2">
      <p className="text-xs font-bold uppercase tracking-wide text-gold-700">
        Lesson · step {index + 1} of {LESSON_STAGES.length}: {LESSON_STAGES[index].label}
      </p>
      <ol className="mt-2 flex gap-1">
        {LESSON_STAGES.map((stage, i) => (
          <li
            key={stage.id}
            title={stage.label}
            aria-current={i === index ? "step" : undefined}
            className={`h-1.5 flex-1 rounded-full ${i < index ? "bg-navy" : i === index ? "bg-gold" : "bg-navy-100"}`}
          >
            <span className="sr-only">
              {stage.label}
              {i < index ? " (done)" : i === index ? " (now)" : ""}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
