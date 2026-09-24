import { fenceBareDiagrams } from "@/lib/tutor/diagrams";

/** Deepgram's per-request limit is 2,000 characters; voice replies are normally ~700. */
export const MAX_TTS_CHARS = 2000;

/** Reads LaTeX maths the way a teacher would say it: "x squared plus 5x equals minus 6". */
export function mathToWords(tex: string): string {
  return tex
    .replace(/\\text\{([^}]*)\}/g, " $1 ")
    .replace(/\\d?frac\{([^}]*)\}\{([^}]*)\}/g, " $1 over $2 ")
    .replace(/\\sqrt\{([^}]*)\}/g, " the square root of $1 ")
    .replace(/\\sqrt\s*(\d+|[a-zA-Z])/g, " the square root of $1 ")
    .replace(/\^2(?!\d)/g, " squared")
    .replace(/\^3(?!\d)/g, " cubed")
    .replace(/\^\{([^}]*)\}/g, " to the power of $1")
    .replace(/\^(\w)/g, " to the power of $1")
    .replace(/\\pm|±/g, " plus or minus ")
    .replace(/\\times|×|\*/g, " times ")
    .replace(/\\div|÷/g, " divided by ")
    .replace(/\\(?:neq|ne)\b|≠/g, " is not equal to ")
    .replace(/\\(?:leq|le)\b|≤/g, " is less than or equal to ")
    .replace(/\\(?:geq|ge)\b|≥/g, " is greater than or equal to ")
    .replace(/</g, " is less than ")
    .replace(/>/g, " is greater than ")
    .replace(/=/g, " equals ")
    .replace(/\+/g, " plus ")
    .replace(/[-−]/g, " minus ")
    .replace(/\//g, " over ")
    .replace(/\\pi|π/g, " pi ")
    .replace(/\\(?:left|right|,|;|!|quad|qquad)|\\ /g, " ")
    .replace(/\\[a-zA-Z]+/g, "")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Turns a tutor reply (markdown + LaTeX) into plain text that sounds natural when read aloud. */
export function toSpeech(markdown: string, maxChars: number = MAX_TTS_CHARS): string {
  let text = fenceBareDiagrams(markdown)
    .replace(/```note[\s\S]*?(```|$)/g, "")
    .replace(/```mermaid[\s\S]*?(```|$)/g, "\n(have a look at the diagram)\n")
    .replace(/```[\s\S]*?(```|$)/g, "\n(see the screen)\n")
    .replace(/\$\$[\s\S]*?\$\$/g, " (see the working on screen) ")
    .replace(/\$([^$]+)\$/g, (_, tex: string) => mathToWords(tex))
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__|\*|_)(\S[^*_]*?)\1/g, "$2")
    .replace(/^\s*#{1,6}\s+(.*)$/gm, "$1.")
    .replace(/^\s*(?:[-*•]|\d+\.)\s+/gm, "")
    .replace(/\|/g, " ");

  // Join lines into sentences.
  text = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (/[.!?:)]$/.test(l) ? l : `${l}.`))
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .replace(/\.\./g, ".")
    .trim();

  if (text.length > maxChars) {
    const cut = text.slice(0, maxChars);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
    text = end > 0 ? cut.slice(0, end + 1) : cut;
  }
  return text;
}
