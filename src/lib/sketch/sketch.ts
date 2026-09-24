import { createHash } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { SKETCH_MODEL } from "@/lib/credits/pricing";
import { canonicalSketch, type SketchSpec } from "./spec";

/**
 * Tutor-drawn diagrams for anything outside the built-in library. The tutor asks for one with a
 * ```sketch block; each distinct drawing is generated once and reused for everyone.
 */

const MAX_SVG_CHARS = 60_000;

export function sketchKey(spec: SketchSpec): string {
  return createHash("sha256").update(canonicalSketch(spec)).digest("hex");
}

export function extractSvg(text: string): string | null {
  return text.match(/<svg[\s\S]*<\/svg>/i)?.[0] ?? null;
}

const LABEL = {
  leftX: 160,
  rightX: 460,
  lineChars: 18,
  lineHeight: 17,
  /** Baseline to baseline between neighbouring labels on one side. */
  gap: 30,
  top: 20,
  bottom: 400,
};

export function wrapLabel(text: string): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines.at(-1);
    if (last !== undefined && last.length + 1 + word.length <= LABEL.lineChars) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const num = (n: number) => String(Math.round(n * 10) / 10);

type Label = { x: number; y: number; side: "left" | "right"; lines: string[]; baseline: number };

/**
 * The model marks each part with <label x y side>Name</label> at a point on the part; this swaps
 * the markers for revision-guide labels in two columns, spaced so they never overlap, each with a
 * leader line to its part. Placing labels in code is what keeps every sketch readable.
 */
export function layoutLabels(svg: string): string {
  const labels: Label[] = [];
  const stripped = svg.replace(/<label\b([^>]*)>([\s\S]*?)<\/label>/gi, (_, attrs: string, body: string) => {
    const attr = (name: string) => attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`))?.[1];
    const x = Number(attr("x"));
    const y = Number(attr("y"));
    const text = decode(body.replace(/<[^>]*>/g, "")).trim();
    if (!Number.isFinite(x) || !Number.isFinite(y) || !text) return "";
    const side = attr("side") === "left" || attr("side") === "right" ? (attr("side") as Label["side"]) : x < 310 ? "left" : "right";
    labels.push({ x, y, side, lines: wrapLabel(text), baseline: 0 });
    return "";
  });
  if (labels.length === 0) return svg;

  const extra = (l: Label) => LABEL.lineHeight * (l.lines.length - 1);
  for (const side of ["left", "right"] as const) {
    const column = labels.filter((l) => l.side === side).sort((a, b) => a.y - b.y);
    column.forEach((l, i) => {
      const below = i === 0 ? LABEL.top : column[i - 1].baseline + extra(column[i - 1]) + LABEL.gap;
      l.baseline = Math.max(l.y + 5, below);
    });
    for (let i = column.length - 1; i >= 0; i--) {
      const l = column[i];
      const limit = i === column.length - 1 ? LABEL.bottom : column[i + 1].baseline - LABEL.gap;
      l.baseline = Math.min(l.baseline, limit - extra(l));
    }
  }

  // Each label is its own group so the viewer can slide the columns clear of a drawing that spills wide.
  const parts = labels.map((l) => {
    const left = l.side === "left";
    const tx = left ? LABEL.leftX : LABEL.rightX;
    const [first, ...rest] = l.lines.map(escape);
    const tspans = rest.map((line) => `<tspan x="${tx}" dy="${LABEL.lineHeight}">${line}</tspan>`).join("");
    return (
      `<g class="sketch-label" data-side="${l.side}">` +
      `<line x1="${left ? tx + 6 : tx - 6}" y1="${num(l.baseline - 5)}" x2="${num(l.x)}" y2="${num(l.y)}" stroke="#0b1e3c" stroke-width="1.3"/>` +
      `<circle cx="${num(l.x)}" cy="${num(l.y)}" r="2.5" fill="#0b1e3c"/>` +
      `<text x="${tx}" y="${num(l.baseline)}" text-anchor="${left ? "end" : "start"}" font-family="Inter, system-ui, sans-serif" font-size="15" fill="#0b1e3c">${first}${tspans}</text>` +
      `</g>`
    );
  });
  const at = stripped.lastIndexOf("</svg>");
  return `${stripped.slice(0, at)}<g class="sketch-labels">${parts.join("")}</g>${stripped.slice(at)}`;
}

/** Server-side gate before a drawing is stored (the browser also sanitises with DOMPurify). */
export function isSafeSvg(svg: string): boolean {
  if (svg.length > MAX_SVG_CHARS) return false;
  if (/<\s*(script|foreignObject|iframe|object|embed|style)\b/i.test(svg)) return false;
  if (/\son\w+\s*=/i.test(svg)) return false;
  if (/javascript:|data:text\/html/i.test(svg)) return false;
  if (/(?:xlink:)?href\s*=\s*["'](?!#)/i.test(svg)) return false;
  return true;
}

export const SKETCH_SYSTEM = `You draw clean, accurate, textbook-style SVG diagrams for UK GCSE students (age 14 to 16), in the style of a good revision guide.
Output ONLY one <svg> element. No explanation, no markdown fences.

Canvas
- viewBox="0 0 620 410", no width or height attributes, a white background <rect width="620" height="410" fill="#ffffff"/>.
- The drawing lives in the middle band, x 180 to 440, and fills it: use most of the height (y 25 to 390) so the parts are big and clear. Nothing else goes outside that band; the sides are kept free for labels.

Labels: mark the parts, don't letter them
- Do NOT write label text or draw leader lines yourself. They are added for you in two tidy columns.
- For each part to name, add one marker: <label x="265" y="127" side="left">Nucleus</label>
  (x, y) is a point ON that part (inside it, or on its edge for a thin part such as a membrane or wire); the leader line ends there.
  side is "left" or "right": pick the side the part is nearer, and spread the markers fairly evenly between the two sides.
- Short standard names with a capital first letter ("Cell body", "Myelin sheath", "Round-bottomed flask").
- Direction and flow arrows (impulse direction, water in and out, heat, current) are part of the drawing: draw the arrow with a small filled triangle head exactly where the flow happens, then name it with a marker on the arrow.
- Short text that belongs inside the picture (a value on a scale, "+" and "-" on a cell) can be drawn as <text> inside the band, never over a line.

Style
- font-family="Inter, system-ui, sans-serif", font-size="15", fill="#0b1e3c" for any text.
- Outlines #0b1e3c, 2 to 3.5 px. Soft fills (light blues, peaches, greens, pinks, greys). Accent #c19a3e sparingly.

Accuracy
- Scientifically correct for AQA, Edexcel and OCR GCSE, drawn the way a GCSE textbook draws it: real proportions, real orientation, parts connected where they really connect, flows going the right way.
- Get right the details exam questions test (for example where a thermometer bulb sits, which end water enters a condenser, which way an impulse travels).
- Mark what was asked for, and nothing extra.
- No <script>, <style>, <foreignObject>, event handlers, links or images.`;

export function sketchRequest({ title, labels, detail }: SketchSpec): string {
  return [
    `Title: ${title}`,
    labels.length ? `Mark exactly these parts, with exactly these names: ${labels.join("; ")}` : "",
    detail ? `Details: ${detail}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Opus 5 with brief thinking draws markedly more accurate apparatus and anatomy than Sonnet 5
 * (compared side by side: 13-23 s and 2-5p per drawing, paid once and then reused by everyone).
 */
export async function drawSketch(client: Pick<Anthropic, "messages">, spec: SketchSpec) {
  const message = await client.messages.create({
    model: SKETCH_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    system: SKETCH_SYSTEM,
    messages: [{ role: "user", content: sketchRequest(spec) }],
  });
  const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const svg = extractSvg(text);
  return { svg: svg ? layoutLabels(svg) : null, usage: message.usage };
}
