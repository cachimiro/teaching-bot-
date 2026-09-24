import { z } from "zod";
import { compile } from "@/lib/maths/expression";

/**
 * Interactive activities the tutor can put in a reply, as fenced JSON blocks:
 *   ```quiz     multiple-choice check with instant feedback
 *   ```order    drag the steps of a process into order
 *   ```explore  "what happens if…": sliders on a formula with a live result
 * plus [[answer]] gaps inside working-out board lines. Everything is checked in the browser and the
 * student's result is sent back to the tutor as their next message.
 */

/** A single-letter symbol: Latin or Greek (ρ for density, λ for wavelength). */
const SYMBOL = /^[a-zA-ZΑ-Ωα-ω]$/;

const Quiz = z
  .object({
    question: z.string().min(1).max(300),
    options: z.array(z.string().min(1).max(160)).min(2).max(5),
    answer: z.number().int().min(0),
    explain: z.string().max(400).optional(),
  })
  .refine((q) => q.answer < q.options.length, "answer must point at one of the options");

const Order = z.object({
  prompt: z.string().min(1).max(200),
  items: z.array(z.string().min(1).max(120)).min(3).max(10),
});

const Input = z.object({
  label: z.string().max(40).optional(),
  min: z.number().finite(),
  max: z.number().finite(),
  value: z.number().finite(),
  step: z.number().positive().optional(),
  unit: z.string().max(12).optional(),
});

const Explore = z.object({
  title: z.string().max(80).optional(),
  formula: z.string().min(3).max(120),
  inputs: z.record(z.string().regex(SYMBOL), Input).refine((r) => Object.keys(r).length >= 1 && Object.keys(r).length <= 4, "1 to 4 inputs"),
  output: z.object({ label: z.string().max(40).optional(), unit: z.string().max(12).optional(), dp: z.number().int().min(0).max(4).optional() }),
  plot: z.string().regex(SYMBOL).optional(),
  question: z.string().max(200).optional(),
});

export type QuizSpec = z.infer<typeof Quiz>;
export type OrderSpec = z.infer<typeof Order>;
export type ExploreSpec = Omit<z.infer<typeof Explore>, "output"> & {
  output: z.infer<typeof Explore>["output"] & { symbol: string };
  evaluate: (values: Record<string, number>) => number;
};

export type Activity =
  | { kind: "quiz"; spec: QuizSpec }
  | { kind: "order"; spec: OrderSpec }
  | { kind: "explore"; spec: ExploreSpec }
  | { kind: "error"; message: string };

export const ACTIVITY_LANGS = ["quiz", "order", "explore"] as const;

export function parseActivity(lang: string, json: string): Activity {
  try {
    const raw = parseLoose(json);
    if (lang === "quiz") return { kind: "quiz", spec: Quiz.parse(raw) };
    if (lang === "order") return { kind: "order", spec: Order.parse(raw) };
    if (lang === "explore") return { kind: "explore", spec: parseExplore(raw) };
    return { kind: "error", message: `Unknown activity ${lang}` };
  } catch (err) {
    return { kind: "error", message: err instanceof z.ZodError ? err.issues[0].message : (err as Error).message };
  }
}

/**
 * JSON, or (as a fallback, because models sometimes write it) simple "key: value" lines where list
 * values are comma-separated or given as "- item" lines below the key.
 */
function parseLoose(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const out: Record<string, unknown> = {};
    let listKey: string | null = null;
    for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
      const bullet = line.match(/^[-*•]\s+(.*)$/);
      if (bullet && listKey) {
        (out[listKey] as string[]).push(bullet[1].trim());
        continue;
      }
      const kv = line.match(/^"?(\w+)"?\s*:\s*(.*)$/);
      if (!kv) throw new Error("Activity is not valid JSON");
      const [, key, value] = kv;
      if ((key === "items" || key === "options") && !value) {
        out[key] = [];
        listKey = key;
      } else if (key === "items" || key === "options") {
        out[key] = value.split(",").map((v) => v.trim()).filter(Boolean);
        listKey = null;
      } else {
        out[key] = key === "answer" && /^\d+$/.test(value) ? Number(value) : value.replace(/^"|"$/g, "");
        listKey = null;
      }
    }
    return out;
  }
}

const GREEK: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", theta: "θ", lambda: "λ", mu: "μ",
  pi: "π", rho: "ρ", sigma: "σ", tau: "τ", phi: "φ", omega: "ω", Delta: "Δ", Omega: "Ω", Sigma: "Σ",
};

/** The tutor sometimes writes \rho or \lambda (LaTeX) where the formula needs the letter itself. */
function greekLetters(s: string): string {
  return s.replace(/\\([A-Za-z]+)/g, (whole, name: string) => GREEK[name] ?? whole);
}

function parseExplore(raw: unknown): ExploreSpec {
  const parsed = Explore.parse(raw);
  const spec = {
    ...parsed,
    formula: greekLetters(parsed.formula),
    inputs: Object.fromEntries(Object.entries(parsed.inputs).map(([k, v]) => [greekLetters(k), v])),
    plot: parsed.plot && greekLetters(parsed.plot),
  };
  const [left, right] = spec.formula.split("=").map((s) => s.trim());
  if (!right || !SYMBOL.test(left)) throw new Error('The formula needs one letter on the left, e.g. "I = V / R"');
  const names = Object.keys(spec.inputs);
  for (const [name, input] of Object.entries(spec.inputs)) {
    if (input.min >= input.max) throw new Error(`Slider ${name} needs min below max`);
  }
  if (spec.plot && !names.includes(spec.plot)) throw new Error(`plot must be one of the inputs`);
  const fn = compile(right, names.filter((n) => n !== "x"));
  return {
    ...spec,
    output: { ...spec.output, symbol: left },
    evaluate: (values) => fn({ x: values.x ?? NaN, ...values }),
  };
}

// ---------------------------------------------------------------------------
// Gaps on the working-out board: [[answer]] or [[answer|alternative]]
// ---------------------------------------------------------------------------

export type GapPiece = { text: string } | { answers: string[] };

export function parseGaps(line: string): GapPiece[] {
  const pieces: GapPiece[] = [];
  let last = 0;
  for (const m of line.matchAll(/\[\[([^\]]+)\]\]/g)) {
    if (m.index! > last) pieces.push({ text: line.slice(last, m.index) });
    pieces.push({ answers: m[1].split("|").map((a) => a.trim()) });
    last = m.index! + m[0].length;
  }
  if (last < line.length) pieces.push({ text: line.slice(last) });
  return pieces;
}

export const hasGaps = (line: string) => /\[\[[^\]]+\]\]/.test(line);

/**
 * True when a gap sits inside LaTeX braces (a fraction, a root, a power), where the line can't be
 * split around an answer box and still be valid LaTeX.
 */
export function gapsInsideBraces(line: string): boolean {
  let depth = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\\") {
      i++; // skip the escaped character, e.g. \{ or \}
    } else if (ch === "{") depth++;
    else if (ch === "}") depth = Math.max(0, depth - 1);
    else if (ch === "[" && line[i + 1] === "[" && depth > 0) return true;
  }
  return false;
}

/** The line as one LaTeX expression with each gap shown as a numbered box (or its answer). */
export function boxGaps(line: string, firstGap: number, reveal: boolean): string {
  let n = firstGap;
  return parseGaps(line)
    .map((piece) => ("text" in piece ? piece.text : reveal ? `\\boxed{${piece.answers[0]}}` : `\\boxed{\\,\\textsf{${++n}}\\,}`))
    .join("");
}

/** Replaces gaps with "blank" so answers are never read out. */
export function stripGaps(line: string): string {
  return line.replace(/\[\[[^\]]+\]\]/g, " blank ");
}

function normalise(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[−–]/g, "-")
    .replace(/[’]/g, "'")
    .replace(/\s+/g, "");
}

function asNumber(s: string): number | null {
  const frac = s.match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  return /^-?\d*\.?\d+$/.test(s) ? Number(s) : null;
}

/** Accepts equivalent forms: spacing, case, Unicode minus, trailing zeros, simple fractions. */
export function checkGap(input: string, answers: string[]): boolean {
  const given = normalise(input);
  if (!given) return false;
  return answers.some((answer) => {
    const expected = normalise(answer);
    if (given === expected) return true;
    const a = asNumber(given);
    const b = asNumber(expected);
    return a !== null && b !== null && Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b));
  });
}

// ---------------------------------------------------------------------------

/** A fixed shuffle (same on every render and reload) that is never already in the right order. */
export function scrambled<T>(items: T[]): T[] {
  const seed = JSON.stringify(items);
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    const j = Math.abs(h) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out.every((v, i) => v === items[i])) out.push(out.shift()!);
  return out;
}

// ---------------------------------------------------------------------------
// Lesson flow: ```lesson {"stage": "explain"} at the top of each lesson reply drives a progress bar.
// ---------------------------------------------------------------------------

export const LESSON_STAGES = [
  { id: "hook", label: "Why it matters" },
  { id: "explain", label: "Explain" },
  { id: "check", label: "Quick check" },
  { id: "example", label: "Worked example" },
  { id: "try", label: "Your turn" },
  { id: "recap", label: "Recap" },
] as const;

export type LessonStage = { index: number; stage: (typeof LESSON_STAGES)[number] };

/** The latest lesson stage in a run of replies (newest last), or null if no lesson has started. */
export function latestLessonStage(replies: string[]): LessonStage | null {
  for (let i = replies.length - 1; i >= 0; i--) {
    const blocks = [...replies[i].matchAll(/```lesson[^\n]*\n([\s\S]*?)```/g)];
    for (let j = blocks.length - 1; j >= 0; j--) {
      const stage = parseLessonStage(blocks[j][1]);
      if (stage) return stage;
    }
  }
  return null;
}

export function parseLessonStage(body: string): LessonStage | null {
  let stage: unknown;
  try {
    stage = (JSON.parse(body) as { stage?: unknown }).stage;
  } catch {
    stage = body.match(/stage\s*:\s*"?(\w+)"?/)?.[1];
  }
  const index = LESSON_STAGES.findIndex((s) => s.id === stage);
  return index >= 0 ? { index, stage: LESSON_STAGES[index] } : null;
}

/** The message sent to the tutor when the student finishes an activity. */
export const activityMessages = {
  quiz: (spec: QuizSpec, chosen: number) =>
    chosen === spec.answer
      ? `Quick check "${spec.question}": I chose "${spec.options[chosen]}" (correct).`
      : `Quick check "${spec.question}": I chose "${spec.options[chosen]}" (wrong; the answer was "${spec.options[spec.answer]}").`,
  order: (spec: OrderSpec, order: string[]) => {
    const right = order.filter((item, i) => item === spec.items[i]).length;
    return `Put in order "${spec.prompt}": ${right} of ${spec.items.length} in the right place. My order: ${order.join(" → ")}.`;
  },
  gaps: (results: { given: string; correct: boolean; answer: string }[]) => {
    const right = results.filter((r) => r.correct).length;
    const detail = results.map((r) => (r.correct ? `"${r.given}" ✓` : `"${r.given}" ✗ (answer ${r.answer})`)).join(", ");
    return `Filled the gaps on the board: ${right} of ${results.length} right. ${detail}.`;
  },
};
