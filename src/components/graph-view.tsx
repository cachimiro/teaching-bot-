"use client";

import katex from "katex";
import { useId, useMemo, useState } from "react";
import { analyseGraph, niceTicks, parseGraphSpec, type Mark } from "@/lib/maths/graph";

const W = 560;
const H = 360;
const PAD = { left: 44, right: 16, top: 16, bottom: 40 };
const CURVE_COLOURS = ["#0b1e3c", "#c19a3e", "#3f63a0"];
const MARK_STYLE: Record<Mark["kind"], { fill: string; stroke: string }> = {
  root: { fill: "#c19a3e", stroke: "#0b1e3c" },
  vertex: { fill: "#0b1e3c", stroke: "#ffffff" },
  "y-intercept": { fill: "#3f63a0", stroke: "#ffffff" },
  intersection: { fill: "#c19a3e", stroke: "#0b1e3c" },
  point: { fill: "#ffffff", stroke: "#0b1e3c" },
};

const fmt = (v: number) => String(Math.round(v * 100) / 100).replace("-", "−");
const tex = (math: string) => katex.renderToString(math, { throwOnError: false, output: "html" });

/** An accurate, interactive graph from a ```graph block: curves, data, labelled key points and sliders. */
export function GraphView({ json, pending }: { json: string; pending: boolean }) {
  const parsed = useMemo(() => {
    if (pending) return null;
    try {
      return { spec: parseGraphSpec(json), error: null };
    } catch (err) {
      return { spec: null, error: (err as Error).message };
    }
  }, [json, pending]);

  if (pending) {
    return (
      <div className="my-3 flex h-40 items-center justify-center rounded-xl border border-dashed border-navy-100 text-xs text-muted">
        Drawing graph…
      </div>
    );
  }
  if (!parsed?.spec) {
    return <p className="my-3 text-xs italic text-muted">(The graph couldn&apos;t be drawn. Ask the tutor to try again.)</p>;
  }
  return <Graph spec={parsed.spec} />;
}

function Graph({ spec }: { spec: ReturnType<typeof parseGraphSpec> }) {
  const clipId = `plot-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [values, setValues] = useState(spec.params);
  const g = useMemo(() => analyseGraph(spec, values), [spec, values]);

  const [x0, x1] = g.x;
  const [y0, y1] = g.y;
  const w = W - PAD.left - PAD.right;
  const h = H - PAD.top - PAD.bottom;
  const sx = (x: number) => PAD.left + ((x - x0) / (x1 - x0)) * w;
  const sy = (y: number) => PAD.top + ((y1 - y) / (y1 - y0)) * h;
  const xTicks = g.categories ? g.categories.map((_, i) => i).filter((i) => i >= x0 && i <= x1) : niceTicks(x0, x1);
  const xTickLabel = (t: number) => (g.categories ? (g.categories[t] ?? "") : t === 0 && axisX === sx(0) ? "" : fmt(t));
  const barSeries = g.series.filter((s) => s.style === "bars");
  const barWidth = 0.7 / Math.max(1, barSeries.length);
  const yTicks = niceTicks(y0, y1, 6);
  const axisY = y0 <= 0 && y1 >= 0 ? sy(0) : sy(y0);
  // Category charts keep the y-axis at the left edge rather than through the first bar.
  const axisX = !g.categories && x0 <= 0 && x1 >= 0 ? sx(0) : sx(x0);
  const path = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join("");

  const roots = g.marks.filter((m) => m.kind === "root");
  const summary = [
    spec.title,
    spec.mark.includes("roots") && (roots.length ? `Crosses the x-axis at ${roots.map((r) => `x = ${fmt(r.x)}`).join(" and ")}` : "Doesn't cross the x-axis"),
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <figure className="my-3 rounded-xl border border-navy-100 bg-white p-3">
      {spec.title && <figcaption className="mb-1 text-sm font-semibold text-navy">{spec.title}</figcaption>}
      {spec.functions.some((f) => f.label) && (
        <div className="mb-1 flex flex-wrap gap-4 text-sm">
          {spec.functions.map((f, i) =>
            f.label ? (
              <span key={i} className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 rounded" style={{ background: CURVE_COLOURS[i] }} />
                <span dangerouslySetInnerHTML={{ __html: tex(f.label) }} />
              </span>
            ) : null,
          )}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={summary || "Graph"}>
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD.left} y={PAD.top} width={w} height={h} />
          </clipPath>
        </defs>
        {xTicks.map((t) => (
          <line key={`gx${t}`} x1={sx(t)} x2={sx(t)} y1={PAD.top} y2={PAD.top + h} stroke="#eef2f8" />
        ))}
        {yTicks.map((t) => (
          <line key={`gy${t}`} x1={PAD.left} x2={PAD.left + w} y1={sy(t)} y2={sy(t)} stroke="#eef2f8" />
        ))}
        <line x1={PAD.left} x2={PAD.left + w} y1={axisY} y2={axisY} stroke="#5b6675" strokeWidth={1.2} />
        <line x1={axisX} x2={axisX} y1={PAD.top} y2={PAD.top + h} stroke="#5b6675" strokeWidth={1.2} />
        {xTicks.map((t) => (
          <text key={`tx${t}`} x={sx(t)} y={axisY + 14} fontSize={11} textAnchor="middle" fill="#5b6675">
            {xTickLabel(t)}
          </text>
        ))}
        {yTicks.map((t) => (
          <text key={`ty${t}`} x={axisX - 6} y={sy(t) + 4} fontSize={11} textAnchor="end" fill="#5b6675">
            {t === 0 ? "0" : fmt(t)}
          </text>
        ))}
        <g clipPath={`url(#${clipId})`}>
          {g.curves.map((c, i) =>
            c.segments.map((seg, j) => <path key={`c${i}-${j}`} d={path(seg)} fill="none" stroke={CURVE_COLOURS[i]} strokeWidth={2.5} />),
          )}
          {g.series.map((s, i) => {
            const colour = CURVE_COLOURS[i];
            if (s.style === "bars") {
              const offset = (barSeries.indexOf(s) - (barSeries.length - 1) / 2) * barWidth;
              return (
                <g key={`s${i}`}>
                  {s.points.map(([x, y], j) => {
                    const left = sx(x + offset - barWidth / 2);
                    const top = Math.min(sy(y), sy(0));
                    return (
                      <rect key={j} x={left} y={top} width={sx(x + offset + barWidth / 2) - left} height={Math.abs(sy(y) - sy(0))} fill={colour} opacity={0.85}>
                        <title>{`${g.categories?.[x] ?? fmt(x)}: ${fmt(y)}`}</title>
                      </rect>
                    );
                  })}
                </g>
              );
            }
            return (
              <g key={`s${i}`}>
                {s.style === "line" && <path d={path(s.points)} fill="none" stroke={colour} strokeWidth={2.5} />}
                {s.points.map(([x, y], j) => (
                  <circle key={j} cx={sx(x)} cy={sy(y)} r={s.style === "points" ? 4.5 : 3.5} fill={s.style === "points" ? "#fff" : colour} stroke={colour} strokeWidth={2} />
                ))}
              </g>
            );
          })}
        </g>
        {g.marks.map((m, i) => {
          const style = MARK_STYLE[m.kind];
          const cx = sx(m.x);
          const cy = sy(m.y);
          const anchor = cx > W - 120 ? "end" : "start";
          const dx = anchor === "end" ? -8 : 8;
          const dy = m.kind === "root" ? (i % 2 ? 18 : -10) : m.kind === "vertex" && m.y <= (y0 + y1) / 2 ? 18 : -10;
          return (
            <g key={`m${i}`}>
              <circle cx={cx} cy={cy} r={5} fill={style.fill} stroke={style.stroke} strokeWidth={1.5} />
              <text x={cx + dx} y={cy + dy} fontSize={12} fontWeight={600} fill="#0b1e3c" textAnchor={anchor} paintOrder="stroke" stroke="#fff" strokeWidth={3}>
                {m.label.replace(/-/g, "−")}
              </text>
            </g>
          );
        })}
        {spec.xLabel && (
          <text x={PAD.left + w / 2} y={H - 6} fontSize={12} textAnchor="middle" fill="#1a2230">
            {spec.xLabel}
          </text>
        )}
        {spec.yLabel && (
          <text x={12} y={PAD.top + h / 2} fontSize={12} textAnchor="middle" fill="#1a2230" transform={`rotate(-90 12 ${PAD.top + h / 2})`}>
            {spec.yLabel}
          </text>
        )}
      </svg>

      {Object.keys(values).length > 0 && (
        <div className="mt-2 grid gap-2 rounded-lg bg-paper p-3 sm:grid-cols-2">
          {Object.entries(values).map(([name, value]) => {
            const start = spec.params[name];
            const min = Math.min(-10, Math.floor(start) - 5);
            const max = Math.max(10, Math.ceil(start) + 5);
            return (
              <label key={name} className="flex items-center gap-3 text-sm text-navy">
                <span className="w-14 font-semibold italic">
                  {name} = {fmt(value)}
                </span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={0.25}
                  value={value}
                  onChange={(e) => setValues((v) => ({ ...v, [name]: Number(e.target.value) }))}
                  className="flex-1 accent-navy"
                  aria-label={`Change ${name}`}
                />
              </label>
            );
          })}
          {spec.mark.includes("roots") && (
            <p className="text-sm font-medium text-navy sm:col-span-2" aria-live="polite">
              {roots.length === 0
                ? "No real roots: the curve doesn't cross the x-axis."
                : roots.length === 1
                  ? `One root: x = ${fmt(roots[0].x)} (the curve just touches the x-axis).`
                  : `Roots: ${roots.map((r) => `x = ${fmt(r.x)}`).join(" and ")}.`}
            </p>
          )}
          <button
            type="button"
            onClick={() => setValues(spec.params)}
            className="w-fit text-xs font-semibold text-navy-400 hover:text-navy sm:col-span-2"
          >
            Reset
          </button>
        </div>
      )}
    </figure>
  );
}
