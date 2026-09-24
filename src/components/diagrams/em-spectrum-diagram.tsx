"use client";

import { useState } from "react";
import type { CustomDiagramProps } from "@/lib/diagrams/types";
import { EM_BANDS, findBand, type EmBand } from "@/lib/diagrams/library/physics";
import { Arrow, BLUE, DiagramFigure, GLOW, GOLD, GUIDE, Label, MUTED, NAVY } from "./physics-ui";

const W = 720;
const H = 250;
const X0 = 24;
const CELL = 96;
const BAND_TOP = 100;
const BAND_H = 72;
const RAINBOW: [string, string][] = [
  ["red", "#e53935"],
  ["orange", "#fb8c00"],
  ["yellow", "#fdd835"],
  ["green", "#43a047"],
  ["blue", "#1e88e5"],
  ["indigo", "#3949ab"],
  ["violet", "#8e24aa"],
];

/** A wave whose wavelength shrinks steadily from left to right (drawn once). */
const CHIRP = (() => {
  const length = CELL * EM_BANDS.length;
  const [start, end] = [120, 10];
  const k = Math.log(end / start) / length;
  let d = "";
  for (let x = 0; x <= length; x += 1) {
    const phase = (2 * Math.PI * (Math.exp(-k * x) - 1)) / (-k * start);
    d += `${x ? "L" : "M"}${X0 + x},${(50 - 9 * Math.sin(phase)).toFixed(2)}`;
  }
  return d;
})();

/**
 * The electromagnetic spectrum as seven bands, with wavelength decreasing and frequency and energy
 * increasing to the right, a zoom on the visible spectrum, and each band's uses and dangers on tap.
 */
export function EmSpectrumDiagram({ highlight, mode }: CustomDiagramProps) {
  const lit = new Set(highlight.map((h) => findBand(h)?.id).filter(Boolean));
  const [selected, setSelected] = useState<string | null>(() => highlight.map((h) => findBand(h)?.id).find(Boolean) ?? null);
  const [revealed, setRevealed] = useState<string[]>([]);
  const blank = mode === "blank";
  const band: EmBand | undefined = EM_BANDS.find((b) => b.id === selected);

  const choose = (id: string) => {
    setSelected(id);
    if (blank) setRevealed((r) => (r.includes(id) ? r : [...r, id]));
  };
  const visibleX = X0 + CELL * EM_BANDS.findIndex((b) => b.id === "visible");
  const stripX = visibleX + CELL / 2 - 140;

  return (
    <DiagramFigure title="The electromagnetic spectrum">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full select-none"
        role="group"
        aria-label="Electromagnetic spectrum from longest to shortest wavelength: radio waves, microwaves, infrared, visible light, ultraviolet, X-rays, gamma rays. Frequency and energy increase in the same order."
      >
        <Label x={W / 2} y={18} weight={700}>
          Wavelength decreases
        </Label>
        <Arrow x1={X0} y1={27} x2={W - X0} y2={27} width={2} head={10} />
        <path d={CHIRP} fill="none" stroke={BLUE} strokeWidth={2} strokeLinejoin="round" />
        <Label x={W / 2} y={80} weight={700}>
          Frequency and energy increase
        </Label>
        <Arrow x1={X0} y1={89} x2={W - X0} y2={89} width={2} head={10} />

        {EM_BANDS.map((b, i) => {
          const x = X0 + CELL * i;
          const hidden = blank && !revealed.includes(b.id);
          const name = b.lines;
          const nameY = name[1] ? BAND_TOP + 26 : BAND_TOP + 34;
          return (
            <g
              key={b.id}
              role="button"
              tabIndex={0}
              aria-pressed={selected === b.id}
              aria-label={`${hidden ? `Band ${i + 1}` : b.name}: show its uses and dangers`}
              onClick={() => choose(b.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  choose(b.id);
                }
              }}
              className="cursor-pointer"
            >
              <rect x={x} y={BAND_TOP} width={CELL} height={BAND_H} fill={b.fill} />
              {b.id === "visible" &&
                RAINBOW.map(([c, colour], j) => (
                  <rect key={c} x={x + (CELL / 7) * j} y={BAND_TOP} width={CELL / 7 + 0.5} height={BAND_H} fill={colour} opacity={0.32} />
                ))}
              {hidden ? (
                <Label x={x + CELL / 2} y={BAND_TOP + 44} size={22} weight={700} colour={MUTED}>
                  ?
                </Label>
              ) : (
                <>
                  <Label x={x + CELL / 2} y={nameY} size={13} weight={700}>
                    {name[0]}
                  </Label>
                  {name[1] && (
                    <Label x={x + CELL / 2} y={nameY + 16} size={13} weight={700}>
                      {name[1]}
                    </Label>
                  )}
                  <Label x={x + CELL / 2} y={BAND_TOP + 62} size={11} colour={MUTED}>
                    ~{b.typical}
                  </Label>
                </>
              )}
            </g>
          );
        })}
        {/* separators and outline, then the gold outline of lit bands on top */}
        {EM_BANDS.slice(1).map((b, i) => (
          <line key={b.id} x1={X0 + CELL * (i + 1)} x2={X0 + CELL * (i + 1)} y1={BAND_TOP} y2={BAND_TOP + BAND_H} stroke="#fff" strokeWidth={2} pointerEvents="none" />
        ))}
        <rect x={X0} y={BAND_TOP} width={CELL * EM_BANDS.length} height={BAND_H} fill="none" stroke={NAVY} strokeWidth={1.5} pointerEvents="none" />
        {EM_BANDS.map((b, i) =>
          lit.has(b.id) || selected === b.id ? (
            <rect
              key={b.id}
              x={X0 + CELL * i + 1.5}
              y={BAND_TOP + 1.5}
              width={CELL - 3}
              height={BAND_H - 3}
              fill="none"
              stroke={GOLD}
              strokeWidth={3}
              pointerEvents="none"
              style={{ filter: GLOW }}
            />
          ) : null,
        )}

        {/* the visible spectrum, zoomed in: red (longest wavelength) to violet (shortest) */}
        <line x1={visibleX} y1={BAND_TOP + BAND_H} x2={stripX} y2={206} stroke={GUIDE} strokeWidth={1.2} strokeDasharray="3 3" />
        <line x1={visibleX + CELL} y1={BAND_TOP + BAND_H} x2={stripX + 280} y2={206} stroke={GUIDE} strokeWidth={1.2} strokeDasharray="3 3" />
        {RAINBOW.map(([name, colour], j) => (
          <g key={name}>
            <rect x={stripX + 40 * j} y={206} width={40.5} height={18} fill={colour} />
            <text x={stripX + 40 * j + 20} y={240} textAnchor="middle" fontSize={10.5} fill={MUTED} fontFamily="var(--font-inter), system-ui, sans-serif">
              {name}
            </text>
          </g>
        ))}
        <rect x={stripX} y={206} width={280} height={18} fill="none" stroke={NAVY} strokeWidth={1} />
      </svg>

      <div className="mt-2 rounded-lg bg-paper p-3 text-sm text-navy" aria-live="polite">
        {band ? (
          <>
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-base font-semibold">{band.name}</span>
              {band.ionising && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800">ionising</span>}
            </p>
            <p className="mt-1">
              <span className="font-semibold">Typical wavelength:</span> about {band.typical}. Range: {band.range}.
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="font-semibold">Uses</p>
                <ul className="list-disc pl-5">
                  {band.uses.map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-semibold">Dangers</p>
                <p>{band.dangers}</p>
              </div>
            </div>
          </>
        ) : (
          <p>Tap a band to see its typical wavelength, uses and dangers.</p>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">
        All electromagnetic waves are transverse and travel at the same speed through a vacuum: 3 × 10⁸ m/s. Higher frequency means shorter wavelength and more
        energy.
      </p>
    </DiagramFigure>
  );
}
