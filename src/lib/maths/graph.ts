import { z } from "zod";
import { compile, type Fn } from "./expression";

/**
 * The ```graph blocks the tutor writes (JSON), and the maths needed to draw them:
 * sampled curves, roots, turning points, y-intercepts, intersections and sensible axes.
 */

const Range = z.tuple([z.number().finite(), z.number().finite()]).refine(([a, b]) => a < b, "x and y ranges must go from low to high");

const Spec = z.object({
  title: z.string().max(80).optional(),
  functions: z
    .array(z.union([z.string(), z.object({ expr: z.string(), label: z.string().max(60).optional() })]))
    .max(3)
    .default([]),
  params: z.record(z.string().regex(/^[a-wA-Z]$/), z.number().finite()).optional(),
  x: Range.optional(),
  y: Range.optional(),
  mark: z.array(z.enum(["roots", "vertex", "turning", "y-intercept", "intersections"])).default([]),
  points: z.array(z.object({ x: z.number(), y: z.number(), label: z.string().max(30).optional() })).max(10).default([]),
  data: z
    .array(
      z.object({
        points: z.array(z.tuple([z.number(), z.number()])).min(1).max(60),
        label: z.string().max(30).optional(),
        style: z.enum(["line", "points", "bars"]).default("line"),
      }),
    )
    .max(3)
    .default([]),
  xLabel: z.string().max(40).optional(),
  yLabel: z.string().max(40).optional(),
  /** Category names for bar charts: data x-values 0, 1, 2… are labelled with these. */
  categories: z.array(z.string().max(20)).max(12).optional(),
});

export type GraphSpec = {
  title?: string;
  functions: { expr: string; label?: string; fn: Fn }[];
  params: Record<string, number>;
  x?: [number, number];
  y?: [number, number];
  mark: string[];
  points: { x: number; y: number; label?: string }[];
  data: { points: [number, number][]; label?: string; style: "line" | "points" | "bars" }[];
  xLabel?: string;
  yLabel?: string;
  categories?: string[];
};

export function parseGraphSpec(json: string): GraphSpec {
  const raw = Spec.parse(JSON.parse(json));
  const params = raw.params ?? {};
  const functions = raw.functions.map((f) => {
    const { expr, label } = typeof f === "string" ? { expr: f, label: undefined } : f;
    return { expr, ...(label ? { label } : {}), fn: compile(expr, Object.keys(params)) };
  });
  if (functions.length === 0 && raw.data.length === 0 && raw.points.length === 0) throw new Error("The graph has nothing to plot");
  return { ...raw, functions, params } as GraphSpec;
}

export type Mark = { x: number; y: number; kind: "root" | "vertex" | "y-intercept" | "intersection" | "point"; label: string };

export type AnalysedGraph = {
  x: [number, number];
  y: [number, number];
  curves: { label?: string; segments: [number, number][][] }[];
  series: { label?: string; points: [number, number][]; style: "line" | "points" | "bars" }[];
  marks: Mark[];
  categories?: string[];
};

const SAMPLES = 400;
const EPS = 1e-9;

const round = (v: number) => Math.round(v * 1e6) / 1e6;

function bisect(f: (x: number) => number, lo: number, hi: number) {
  let flo = f(lo);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.sign(fm) === Math.sign(flo)) {
      lo = mid;
      flo = fm;
    } else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Local minimum of f on [lo, hi] (golden-section search). */
function minimise(f: (x: number) => number, lo: number, hi: number) {
  const g = (Math.sqrt(5) - 1) / 2;
  let a = lo, b = hi;
  for (let i = 0; i < 80; i++) {
    const c = b - g * (b - a), d = a + g * (b - a);
    if (f(c) < f(d)) b = d;
    else a = c;
  }
  return (a + b) / 2;
}

/** Zeros of f on [lo, hi]: sign changes, plus places where the curve just touches zero. */
function zeros(f: (x: number) => number, lo: number, hi: number): number[] {
  const step = (hi - lo) / SAMPLES;
  const found: number[] = [];
  const add = (x: number) => {
    if (!found.some((r) => Math.abs(r - x) < step)) found.push(x);
  };
  let prevX = lo, prevY = f(lo);
  for (let i = 1; i <= SAMPLES; i++) {
    const x = lo + i * step, y = f(x);
    if (!Number.isFinite(y) || !Number.isFinite(prevY)) {
      prevX = x;
      prevY = y;
      continue;
    }
    if (Math.abs(prevY) < EPS) add(prevX);
    else if (Math.sign(y) !== Math.sign(prevY) && Math.abs(y - prevY) < 1e6) add(bisect(f, prevX, x));
    prevX = x;
    prevY = y;
  }
  // Touching roots: a turning point that sits on the axis.
  for (const t of turningPoints(f, lo, hi)) if (Math.abs(f(t)) < 1e-6) add(t);
  return found.sort((a, b) => a - b).map(round);
}

/** x-values of turning points (local maxima and minima) on [lo, hi]. */
function turningPoints(f: (x: number) => number, lo: number, hi: number): number[] {
  const step = (hi - lo) / SAMPLES;
  const out: number[] = [];
  for (let i = 1; i < SAMPLES; i++) {
    const x0 = lo + (i - 1) * step, x1 = x0 + step, x2 = x1 + step;
    const y0 = f(x0), y1 = f(x1), y2 = f(x2);
    if (![y0, y1, y2].every(Number.isFinite)) continue;
    if (y1 <= y0 && y1 <= y2 && (y1 < y0 || y1 < y2)) out.push(minimise(f, x0, x2));
    else if (y1 >= y0 && y1 >= y2 && (y1 > y0 || y1 > y2)) out.push(minimise((x) => -f(x), x0, x2));
  }
  return out.filter((x, i) => i === 0 || Math.abs(x - out[i - 1]) > step).map(round);
}

export function niceTicks(lo: number, hi: number, target = 8): number[] {
  const raw = (hi - lo) / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => (hi - lo) / s <= target) ?? 10 * mag;
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + step * 1e-9; t += step) ticks.push(round(t));
  return ticks;
}

const fmt = (v: number) => String(Math.round(v * 100) / 100);

export function analyseGraph(spec: GraphSpec, paramValues: Record<string, number> = spec.params): AnalysedGraph {
  const dataXs = spec.data.flatMap((d) => d.points.map((p) => p[0])).concat(spec.points.map((p) => p.x));
  const bars = spec.data.some((d) => d.style === "bars");
  const xRange: [number, number] =
    spec.x ??
    (bars
      ? [Math.min(...dataXs) - 0.6, Math.max(...dataXs) + 0.6]
      : dataXs.length
        ? padRange(Math.min(...dataXs), Math.max(...dataXs), 0.05, true)
        : [-10, 10]);
  const fs = spec.functions.map((f) => (x: number) => f.fn({ ...paramValues, x }));
  const [lo, hi] = xRange;
  const step = (hi - lo) / SAMPLES;

  const marks: Mark[] = [];
  const wants = (k: string) => spec.mark.includes(k);
  fs.forEach((f) => {
    if (wants("roots")) for (const x of zeros(f, lo, hi)) marks.push({ x, y: 0, kind: "root", label: `x = ${fmt(x)}` });
    if (wants("vertex") || wants("turning"))
      for (const x of turningPoints(f, lo, hi)) marks.push({ x, y: round(f(x)), kind: "vertex", label: `(${fmt(x)}, ${fmt(f(x))})` });
    if (wants("y-intercept") && lo <= 0 && hi >= 0 && Number.isFinite(f(0)))
      marks.push({ x: 0, y: round(f(0)), kind: "y-intercept", label: `(0, ${fmt(f(0))})` });
  });
  if (wants("intersections"))
    for (let i = 0; i < fs.length; i++)
      for (let j = i + 1; j < fs.length; j++)
        for (const x of zeros((x) => fs[i](x) - fs[j](x), lo, hi))
          marks.push({ x, y: round(fs[i](x)), kind: "intersection", label: `(${fmt(x)}, ${fmt(fs[i](x))})` });
  for (const p of spec.points) marks.push({ x: p.x, y: p.y, kind: "point", label: p.label ?? `(${fmt(p.x)}, ${fmt(p.y)})` });

  // Sample every curve, then size the y-axis to what matters (ignoring huge spikes near asymptotes).
  const samples = fs.map((f) => Array.from({ length: SAMPLES + 1 }, (_, i) => [lo + i * step, f(lo + i * step)] as [number, number]));
  let yRange = spec.y;
  if (!yRange) {
    const ys = samples.flat().map((p) => p[1]).filter(Number.isFinite).sort((a, b) => a - b);
    const trimmed = ys.slice(Math.floor(ys.length * 0.02), Math.ceil(ys.length * 0.98));
    const extra = [...marks.map((m) => m.y), ...spec.data.flatMap((d) => d.points.map((p) => p[1]))];
    const all = [...trimmed, ...extra, 0];
    yRange = padRange(Math.min(...all), Math.max(...all), 0.1, spec.data.length > 0 && spec.functions.length === 0);
    if (bars && yRange[0] < 0 && Math.min(...all) >= 0) yRange = [0, yRange[1]];
  }
  const [ylo, yhi] = yRange;
  const span = yhi - ylo;
  const curves = samples.map((pts, i) => {
    const segments: [number, number][][] = [[]];
    for (const [x, y] of pts) {
      if (!Number.isFinite(y) || y < ylo - span * 2 || y > yhi + span * 2) {
        if (segments[segments.length - 1].length) segments.push([]);
        continue;
      }
      segments[segments.length - 1].push([x, y]);
    }
    return { label: spec.functions[i].label, segments: segments.filter((s) => s.length > 1) };
  });

  return {
    x: xRange,
    y: yRange,
    curves,
    series: spec.data.map((d) => ({ label: d.label, points: d.points, style: d.style })),
    categories: spec.categories,
    marks: marks.filter((m) => m.x >= lo && m.x <= hi),
  };
}

/** Widens [min, max] by a fraction each side; data graphs start at zero where sensible. */
function padRange(min: number, max: number, frac: number, fromZero = false): [number, number] {
  if (min === max) return [min - 1, max + 1];
  const pad = (max - min) * frac;
  const lo = fromZero && min >= 0 ? 0 : min - pad;
  return [lo, max + pad];
}
