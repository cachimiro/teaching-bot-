/**
 * A ```sketch block: {"title": "The human eye", "labels": ["Cornea", "Iris", ...], "detail": "optional"}.
 * Shared by the chat renderer and the /api/sketch route.
 */
export type SketchSpec = { title: string; labels: string[]; detail: string };

const MAX_LABELS = 14;

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export function parseSketchSpec(value: unknown): SketchSpec | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const title = typeof v.title === "string" ? tidy(v.title) : "";
  const seen = new Set<string>();
  const labels = (Array.isArray(v.labels) ? v.labels : [])
    .filter((l): l is string => typeof l === "string")
    .map(tidy)
    .filter((l) => l && !seen.has(norm(l)) && seen.add(norm(l)));
  const detail = typeof v.detail === "string" ? tidy(v.detail) : typeof v.describe === "string" ? tidy(v.describe) : "";
  if (title.length < 2 || title.length > 100 || detail.length > 400) return null;
  if (labels.length > MAX_LABELS || labels.some((l) => l.length > 40)) return null;
  if (labels.length === 0 && detail.length < 3) return null;
  return { title, labels, detail };
}

export function parseSketchJson(json: string): SketchSpec | null {
  try {
    return parseSketchSpec(JSON.parse(json));
  } catch {
    return null;
  }
}

const FILLER = new Set(["the", "a", "an", "of", "labelled", "labeled", "diagram", "sketch", "drawing"]);

/**
 * What makes two sketches the same drawing: the subject and the parts named, whatever order or
 * case the tutor lists them in and however it words the extra detail. This is the cache identity.
 */
export function canonicalSketch(spec: SketchSpec): string {
  const title = norm(spec.title)
    .split(" ")
    .filter((w) => !FILLER.has(w))
    .join(" ");
  if (spec.labels.length === 0) return `${title}||${norm(spec.detail)}`;
  return `${title}|${spec.labels.map(norm).sort().join(",")}`;
}
