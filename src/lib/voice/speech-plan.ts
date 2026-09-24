import { fenceBareDiagrams } from "@/lib/tutor/diagrams";
import { stripGaps } from "@/lib/tutor/activities";
import { mathToWords, toSpeech } from "./speech-text";

/**
 * What to say aloud for a tutor reply, as an ordered list of segments. Prose is spoken in
 * sentence groups; each line of a ```steps working-out board is spoken separately and tagged with
 * its step, so the board can highlight the step being talked about. Graphs and diagrams are silent.
 *
 * Prefix-stable: while a reply streams in, speechPlan(partial) is always the start of
 * speechPlan(final), so the caller can queue segments as they appear.
 */

export type StepRef = { block: number; index: number };
export type SpeechSegment = { text: string; step?: StepRef };
export type Step = { math: string; note: string };

/** Later prose segments are grouped to at least this many characters (fewer, larger TTS requests). */
const GROUP_CHARS = 80;

export function parseSteps(body: string): Step[] {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cut = line.lastIndexOf(" | ");
      const math = (cut >= 0 ? line.slice(0, cut) : line).trim().replace(/^\$+|\$+$/g, "").trim();
      const note = cut >= 0 ? line.slice(cut + 3).trim() : "";
      return { math, note };
    });
}

const MATHS_WORDS = /^(?:sin|cos|tan|log|ln|sqrt|exp|or|and|if)$/i;

/**
 * Whether a board line is maths (render with KaTeX) or words (render as plain text), so a
 * French or word-equation step like "j'ai + mangé" isn't squashed into maths italics.
 */
export function looksLikeMaths(line: string): boolean {
  if (/[àâäçéèêëîïôöûùüÿœ'’]/i.test(line)) return false;
  const words = line
    .replace(/\\text\{[^}]*\}/g, " ")
    .replace(/\\[a-zA-Z]+/g, " ")
    .match(/[a-zA-Z]{3,}/g);
  return !words || words.every((w) => MATHS_WORDS.test(w));
}

/** What to say for a board step: its note, or else the line itself (maths read out in words). */
function stepSpeech(step: Step): string {
  if (step.note) return toSpeech(stripGaps(step.note), Infinity);
  const math = stripGaps(step.math);
  return toSpeech(looksLikeMaths(math) ? "$" + math + "$" : math, Infinity);
}

export function speechPlan(markdown: string, final: boolean): SpeechSegment[] {
  const md = fenceBareDiagrams(markdown);
  const segments: SpeechSegment[] = [];
  const prose = new ProseGrouper(segments);
  let stepsBlock = 0;
  let pos = 0;
  const fence = /```([\w-]*)[^\n]*\n?/g;

  for (;;) {
    fence.lastIndex = pos;
    const open = fence.exec(md);
    if (!open) {
      prose.add(md.slice(pos), final);
      break;
    }
    prose.add(md.slice(pos, open.index), true);
    const bodyStart = open.index + open[0].length;
    const close = md.indexOf("```", bodyStart);
    const closed = close >= 0;
    const body = md.slice(bodyStart, closed ? close : md.length);

    if (open[1] === "steps") {
      // A step line is finished once its newline (or the closing fence) has arrived.
      const complete = closed || final ? body : body.slice(0, body.lastIndexOf("\n") + 1);
      parseSteps(complete).forEach((step, index) => {
        const text = stepSpeech(step);
        if (text) segments.push({ text, step: { block: stepsBlock, index } });
      });
      stepsBlock++;
    }
    if (!closed) break;
    pos = close + 3;
  }
  prose.flush(final);
  return segments;
}

/** Splits prose into sentences as they complete and groups them into speakable segments. */
class ProseGrouper {
  private pending = "";
  constructor(private readonly out: SpeechSegment[]) {}

  add(markdown: string, complete: boolean) {
    const units = markdown.split(/(?<=[.!?:])(?=\s)|\n/);
    const done = complete ? units : units.slice(0, -1);
    for (const unit of done) {
      const text = toSpeech(unit, Infinity);
      if (!text) continue;
      this.pending = this.pending ? `${this.pending} ${text}` : text;
      // The very first segment goes out on its own so speech can start straight away.
      const isFirst = this.out.length === 0;
      if (isFirst || this.pending.length >= GROUP_CHARS) this.emit();
    }
    if (complete) this.emit();
  }

  flush(final: boolean) {
    if (final) this.emit();
  }

  private emit() {
    if (this.pending) this.out.push({ text: this.pending });
    this.pending = "";
  }
}

export { mathToWords };
