"use client";

import { useActionState } from "react";
import { saveSubjectSetting, type FormState } from "@/lib/profile-actions";

/** Asked once per subject: which exam board and tier the student is sitting. */
export function SubjectSetup({
  subject,
  subjectName,
  boards,
  initial,
  compact = false,
}: {
  subject: string;
  subjectName: string;
  boards: ("AQA" | "Edexcel" | "OCR")[];
  initial?: { examBoard: string; tier: string };
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSubjectSetting, {});

  return (
    <form
      action={action}
      className={compact ? "flex flex-wrap items-end gap-3" : "mt-8 max-w-xl rounded-2xl border border-navy-100 bg-white p-6 shadow-sm"}
    >
      <input type="hidden" name="subject" value={subject} />
      {!compact && (
        <>
          <h2 className="font-display text-xl font-semibold text-navy">Set up GCSE {subjectName}</h2>
          <p className="mt-1 text-sm text-muted">So your tutor sets the right questions and marks like your exam board.</p>
        </>
      )}
      <fieldset className={compact ? "" : "mt-5"}>
        <legend className="text-sm font-medium text-navy">{compact ? subjectName : "Exam board"}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {boards.map((b) => (
            <label
              key={b}
              className="cursor-pointer rounded-full border border-navy-100 px-4 py-2 text-sm has-[:checked]:border-navy has-[:checked]:bg-navy has-[:checked]:text-white"
            >
              <input type="radio" name="exam_board" value={b} required defaultChecked={initial?.examBoard === b} className="sr-only" />
              {b}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className={compact ? "" : "mt-5"}>
        {!compact && <legend className="text-sm font-medium text-navy">Tier</legend>}
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            ["foundation", "Foundation (grades 1–5)"],
            ["higher", "Higher (grades 4–9)"],
          ].map(([value, label]) => (
            <label
              key={value}
              className="cursor-pointer rounded-full border border-navy-100 px-4 py-2 text-sm has-[:checked]:border-gold has-[:checked]:bg-gold has-[:checked]:text-navy"
            >
              <input type="radio" name="tier" value={value} required defaultChecked={initial?.tier === value} className="sr-only" />
              {compact ? label.split(" ")[0] : label}
            </label>
          ))}
        </div>
        {!compact && <p className="mt-2 text-xs text-muted">Not sure? Ask your teacher. You can change this later in your account.</p>}
      </fieldset>
      {state.error && <p className="mt-4 text-sm text-red-700">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className={`${compact ? "" : "mt-6"} rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-600 disabled:opacity-60`}
      >
        {pending ? "Saving…" : compact ? (state.saved ? "Saved" : "Save") : "Start learning"}
      </button>
    </form>
  );
}
