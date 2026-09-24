"use client";

import { useActionState } from "react";
import { saveProfile, type FormState } from "@/lib/profile-actions";
import { LEARNING_STYLES } from "@/lib/tutor/prompt";

export type ProfileValues = {
  display_name: string | null;
  year_group: number | null;
  target_grade: string | null;
  learning_style: string[];
  interests: string | null;
  about_me: string | null;
};

const STYLE_LABELS: Record<string, string> = {
  step_by_step: "Step by step",
  examples_first: "Show me an example first",
  analogies: "Real-life comparisons",
  short_direct: "Short and to the point",
  visual: "Diagrams and tables",
  lots_of_practice: "Lots of practice questions",
};

const field =
  "mt-1 w-full rounded-xl border border-navy-100 bg-white px-4 py-3 text-ink shadow-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40";

export function ProfileForm({
  values,
  from,
  next = "/learn",
}: {
  values: ProfileValues;
  from: "onboarding" | "account";
  next?: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfile, {});

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm font-medium text-navy">
        What should your tutor call you? <span className="font-normal text-muted">(first name or a nickname)</span>
        <input name="display_name" maxLength={40} defaultValue={values.display_name ?? ""} className={field} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-navy">
          Year group
          <select name="year_group" required defaultValue={values.year_group ?? 10} className={field}>
            {[7, 8, 9, 10, 11, 12, 13].map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-navy">
          Target grade
          <select name="target_grade" defaultValue={values.target_grade ?? ""} className={field}>
            <option value="">Not sure yet</option>
            {["9", "8", "7", "6", "5", "4", "3"].map((g) => (
              <option key={g} value={g}>
                Grade {g}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset>
        <legend className="text-sm font-medium text-navy">What helps you understand? Pick any.</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {Object.keys(LEARNING_STYLES).map((key) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-navy-100 bg-white px-4 py-3 text-sm has-[:checked]:border-gold has-[:checked]:bg-gold-50"
            >
              <input
                type="checkbox"
                name="learning_style"
                value={key}
                defaultChecked={values.learning_style.includes(key)}
                className="accent-navy"
              />
              {STYLE_LABELS[key]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-medium text-navy">
        What are you into? <span className="font-normal text-muted">(so examples are about things you like)</span>
        <input
          name="interests"
          maxLength={200}
          defaultValue={values.interests ?? ""}
          placeholder="e.g. gaming, football, music, coding, animals"
          className={field}
        />
      </label>
      <label className="block text-sm font-medium text-navy">
        Anything else your tutor should know? <span className="font-normal text-muted">(optional)</span>
        <textarea
          name="about_me"
          maxLength={300}
          rows={3}
          defaultValue={values.about_me ?? ""}
          placeholder="e.g. I get nervous in exams, I find equations hard, I'm dyslexic"
          className={field}
        />
      </label>
      {state.error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>}
      {state.saved && <p className="rounded-xl bg-navy-50 px-4 py-3 text-sm text-navy">Saved.</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-navy px-6 py-3 font-semibold text-white hover:bg-navy-600 disabled:opacity-60"
      >
        {pending ? "Saving…" : from === "onboarding" ? "Start learning" : "Save"}
      </button>
    </form>
  );
}
