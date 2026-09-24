"use client";

import { useMemo, useState } from "react";
import { InlineMaths, tex } from "@/components/inline-maths";
import type { ExploreSpec } from "@/lib/tutor/activities";

const fmt = (v: number, dp = 2) => (Number.isFinite(v) ? (Math.round(v * 10 ** dp) / 10 ** dp).toString().replace("-", "−") : "—");

/** Renders "I = V / R" as maths, showing division as a fraction and * as ×. */
function formulaTex(formula: string) {
  const [left, right] = formula.split("=").map((s) => s.trim());
  const body = right
    .replace(/\*/g, " \\times ")
    .replace(/([a-zA-Z0-9.]+|\([^()]*\))\s*\/\s*([a-zA-Z0-9.]+|\([^()]*\))/g, "\\dfrac{$1}{$2}");
  return `${left} = ${body}`;
}

/** "What happens if…": sliders on a formula, the live result, and how it changed. */
export function ExploreCard({ spec }: { spec: ExploreSpec }) {
  const start = useMemo(() => Object.fromEntries(Object.entries(spec.inputs).map(([k, v]) => [k, v.value])), [spec.inputs]);
  const [values, setValues] = useState(start);
  const dp = spec.output.dp ?? 2;
  const result = spec.evaluate(values);
  const initial = spec.evaluate(start);
  const changed = Object.keys(values).some((k) => values[k] !== start[k]);
  const ratio = initial !== 0 ? result / initial : NaN;

  const plot = useMemo(() => {
    if (!spec.plot) return null;
    const input = spec.inputs[spec.plot];
    const pts = Array.from({ length: 60 }, (_, i) => {
      const x = input.min + ((input.max - input.min) * i) / 59;
      return [x, spec.evaluate({ ...values, [spec.plot!]: x })] as [number, number];
    }).filter(([, y]) => Number.isFinite(y));
    if (pts.length < 2) return null;
    const ys = pts.map((p) => p[1]);
    const [ylo, yhi] = [Math.min(0, ...ys), Math.max(...ys)];
    const sx = (x: number) => 30 + ((x - input.min) / (input.max - input.min)) * 250;
    const sy = (y: number) => 110 - ((y - ylo) / (yhi - ylo || 1)) * 100;
    return { pts, sx, sy, input };
  }, [spec, values]);

  return (
    <div className="my-3 rounded-xl border border-navy-100 bg-white p-4" role="group" aria-label="What happens if">
      <p className="text-xs font-bold uppercase tracking-wide text-gold-700">What happens if…</p>
      {spec.title && <p className="mt-1 font-semibold text-navy">{spec.title}</p>}
      <p className="mt-2 text-lg text-navy" dangerouslySetInnerHTML={{ __html: tex(formulaTex(spec.formula)) }} />

      <div className="mt-3 space-y-3">
        {Object.entries(spec.inputs).map(([name, input]) => (
          <label key={name} className="block text-sm text-navy">
            <span className="flex justify-between">
              <span>
                <em className="font-semibold">{name}</em>
                {input.label ? ` (${input.label})` : ""}
              </span>
              <span className="font-semibold">
                {fmt(values[name])} {input.unit}
              </span>
            </span>
            <input
              type="range"
              min={input.min}
              max={input.max}
              step={input.step ?? (input.max - input.min) / 100}
              value={values[name]}
              onChange={(e) => setValues((v) => ({ ...v, [name]: Number(e.target.value) }))}
              className="mt-1 w-full accent-navy"
              aria-label={`Change ${input.label ?? name}`}
            />
          </label>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg bg-navy px-4 py-3 text-white">
        <span className="text-sm opacity-80">{spec.output.label ?? spec.output.symbol}</span>
        <span className="text-2xl font-bold" aria-live="polite">
          <em>{spec.output.symbol}</em> = {fmt(result, dp)} {spec.output.unit}
        </span>
        {changed && Number.isFinite(ratio) && (
          <span className="text-sm text-gold-300">
            {ratio > 1.0001 ? "▲" : ratio < 0.9999 ? "▼" : "="} was {fmt(initial, dp)}
            {Math.abs(ratio - 1) > 0.0001 && ` (× ${fmt(ratio, 2)})`}
          </span>
        )}
      </div>

      {plot && (
        <svg viewBox="0 0 290 130" className="mt-3 h-auto w-full max-w-sm" role="img" aria-label={`How ${spec.output.symbol} changes with ${spec.plot}`}>
          <line x1={30} x2={280} y1={110} y2={110} stroke="#5b6675" />
          <line x1={30} x2={30} y1={10} y2={110} stroke="#5b6675" />
          <path d={plot.pts.map(([x, y], i) => `${i ? "L" : "M"}${plot.sx(x)},${plot.sy(y)}`).join("")} fill="none" stroke="#0b1e3c" strokeWidth={2} />
          <circle cx={plot.sx(values[spec.plot!])} cy={plot.sy(result)} r={4.5} fill="#c19a3e" stroke="#0b1e3c" />
          <text x={155} y={127} fontSize={10} textAnchor="middle" fill="#5b6675">
            {spec.plot} {plot.input.unit ? `(${plot.input.unit})` : ""}
          </text>
          <text x={8} y={60} fontSize={10} fill="#5b6675" transform="rotate(-90 8 60)" textAnchor="middle">
            {spec.output.symbol} {spec.output.unit ? `(${spec.output.unit})` : ""}
          </text>
        </svg>
      )}

      {spec.question && (
        <p className="mt-3 text-sm font-medium text-navy">
          <InlineMaths text={spec.question} />
        </p>
      )}
      {changed && (
        <button type="button" onClick={() => setValues(start)} className="mt-2 text-xs font-semibold text-navy-400 hover:text-navy">
          Reset
        </button>
      )}
    </div>
  );
}
