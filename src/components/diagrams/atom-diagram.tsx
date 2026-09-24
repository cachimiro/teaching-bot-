"use client";

import { useState } from "react";
import type { CustomDiagramProps } from "@/lib/diagrams/types";
import { ANION_NAMES, chargeLabel, chargeText, highlightKey, ionFormula, resolveAtom } from "@/lib/diagrams/library/atom-model";

const NAVY = "#0b1e3c";
const GOLD = "#c19a3e";
const GOLD_DARK = "#7d6325";
const SHELL = "#a7bbd9";
const CROSS = "#3f63a0";
const FONT = "var(--font-inter), system-ui, sans-serif";
const GLOW = `drop-shadow(0 0 5px ${GOLD}) drop-shadow(0 0 2px ${GOLD})`;

const W = 620;
const H = 440;
const CX = 310;
const CY = 220;
const NUCLEUS_R = 36;
const MAX_R = 178;
const LABEL_FONT = 18;

const polar = (r: number, deg: number): [number, number] => [CX + r * Math.cos((deg * Math.PI) / 180), CY + r * Math.sin((deg * Math.PI) / 180)];

/** Shell radii: evenly spaced out from the nucleus, spread wider when there are fewer shells. */
function shellRadii(count: number): number[] {
  const step = count ? Math.min(46, (MAX_R - NUCLEUS_R) / count) : 0;
  return Array.from({ length: count }, (_, i) => NUCLEUS_R + step * (i + 1));
}

type Electron = { x: number; y: number; shell: number; angle: number; gained: boolean };

/**
 * Electrons spaced evenly round each shell, starting at the top. Electrons beyond the atom's own
 * (z onwards, for negative ions) are "gained": they take the next places clockwise from the top so
 * they sit together on the upper right, where the label can point at them.
 */
function placeElectrons(shells: number[], radii: number[], z: number): Electron[] {
  const out: Electron[] = [];
  let start = 0;
  shells.forEach((count, s) => {
    const gainedHere = Math.max(0, start + count - Math.max(start, z));
    for (let k = 0; k < count; k++) {
      const angle = -90 + (360 * k) / count;
      const [x, y] = polar(radii[s], angle);
      const gained = gainedHere >= count || (k >= 1 && k <= gainedHere);
      out.push({ x, y, shell: s, angle, gained });
    }
    start += count;
  });
  return out;
}

/** A label with a leader line. `gap` stops the line short of its target (e.g. at an electron's edge). */
function Label({ lines, at, to, align, gap = 0 }: { lines: string[]; at: [number, number]; to: [number, number]; align: "start" | "end"; gap?: number }) {
  const [lx, ly] = at;
  const x1 = align === "end" ? lx + 6 : lx - 6;
  const y1 = ly - LABEL_FONT / 3;
  const len = Math.hypot(to[0] - x1, to[1] - y1) || 1;
  const x2 = to[0] - ((to[0] - x1) / len) * gap;
  const y2 = to[1] - ((to[1] - y1) / len) * gap;
  return (
    <g pointerEvents="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={NAVY} strokeWidth={1.4} />
      {gap === 0 && <circle cx={to[0]} cy={to[1]} r={2.5} fill={NAVY} />}
      <text x={lx} y={ly} fontSize={LABEL_FONT} fontWeight={500} textAnchor={align} fill={NAVY} fontFamily={FONT}>
        {lines.map((line, i) => (
          <tspan key={line} x={lx} dy={i ? LABEL_FONT + 2 : 0}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

/** Bohr model of an atom or simple ion (elements 1–20) with the GCSE 2,8,8,2 shells. */
export function AtomDiagram({ spec, highlight, mode, interactive }: CustomDiagramProps) {
  const [revealed, setRevealed] = useState(false);
  const model = resolveAtom(spec);
  if ("error" in model) {
    return <p className="my-3 text-xs italic text-muted">(The atom couldn&apos;t be drawn. Ask the tutor to try again.)</p>;
  }
  const { el, charge, electrons, neutrons, shells, gained } = model;
  const isIon = charge !== 0;
  const showLabels = mode === "labelled" || revealed;
  const lit = new Set(highlight.map(highlightKey).filter(Boolean));

  const radii = shellRadii(shells.length);
  const outerR = radii.length ? radii[radii.length - 1] : NUCLEUS_R;
  const dots = placeElectrons(shells, radii, el.z);
  const formula = ionFormula(el.symbol, charge);
  const config = shells.length ? shells.join(",") : "no electrons";
  const ionName = charge < 0 ? `${ANION_NAMES[el.z] ?? `${el.name.toLowerCase()}`} ion` : `${el.name.toLowerCase()} ion`;
  const title = showLabels
    ? isIon
      ? `${ionName[0].toUpperCase()}${ionName.slice(1)} (${formula})`
      : `${el.name} atom (${el.symbol})`
    : isIon
      ? "Ion: which one is it?"
      : "Atom: which element is it?";

  // Ion brackets and the charge, top right.
  const pad = 26;
  const bx0 = CX - outerR - pad;
  const bx1 = CX + outerR + pad;
  const by0 = Math.max(8, CY - outerR - 22);
  const by1 = Math.min(H - 8, CY + outerR + 22);

  // Labels sit just outside the drawing (and outside the brackets for ions).
  const side = outerR + (isIon ? 36 : 22);
  // Point the electron label at a gained electron (anions) or an outer electron, nearest the upper right.
  const candidates = gained ? dots.filter((d) => d.gained) : dots.filter((d) => d.shell === shells.length - 1);
  const pointAt = candidates.reduce<Electron | null>(
    (best, d) => (!best || Math.cos(((d.angle + 40) * Math.PI) / 180) > Math.cos(((best.angle + 40) * Math.PI) / 180) ? d : best),
    null,
  );
  const shellPoint = polar(outerR, 35);
  const nucleusPoint = polar(NUCLEUS_R, 150);
  const nucleusLabelY = shells.length ? CY + 64 : CY + 30;
  const shellLabelY = shellPoint[1] + 30;
  const electronLines = pointAt?.gained ? ["Electron", "gained"] : ["Electron"];
  const electronLabelY = pointAt ? Math.max(isIon ? by0 + 64 : 30, pointAt.y + 6) : CY;

  // Crop the drawing to the atom (same scale for every element, so bigger atoms look bigger).
  const top = CY - outerR - (isIon ? 32 : 26);
  const bottom = Math.max(
    CY + outerR + (isIon ? 32 : 26),
    nucleusLabelY + 10,
    shells.length ? shellLabelY + 10 : 0,
    electronLabelY + (electronLines.length - 1) * (LABEL_FONT + 2) + 10,
  );

  const aria = `${title}. ${el.z} protons and ${neutrons} neutrons in the nucleus; ${electrons} electron${electrons === 1 ? "" : "s"} arranged ${config}.`;

  return (
    <figure className="my-3 rounded-xl border border-navy-100 bg-white p-3">
      <figcaption className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold text-navy">{title}</span>
        {!showLabels && interactive && (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="rounded-full bg-gold-50 px-3 py-1 text-xs font-semibold text-navy hover:bg-gold-100"
          >
            Show labels
          </button>
        )}
      </figcaption>
      <svg viewBox={`0 ${top} ${W} ${bottom - top}`} className="mx-auto h-auto w-full max-w-xl select-none" role="img" aria-label={showLabels ? aria : "An atom diagram with the labels hidden"}>
        {/* Shells */}
        {radii.map((r, s) => {
          const isOuter = s === radii.length - 1;
          const glow = (isOuter && lit.has("outer")) || lit.has("shells");
          return (
            <circle
              key={`shell-${s}`}
              cx={CX}
              cy={CY}
              r={r}
              fill="none"
              stroke={glow ? GOLD : SHELL}
              strokeWidth={glow ? 4 : 2.2}
              style={{ filter: glow ? GLOW : undefined }}
            />
          );
        })}

        {/* Nucleus */}
        <g style={{ filter: lit.has("nucleus") ? GLOW : undefined }}>
          <circle cx={CX} cy={CY} r={NUCLEUS_R} fill="#f8dccb" stroke={lit.has("nucleus") ? GOLD : NAVY} strokeWidth={lit.has("nucleus") ? 3.5 : 2.5} />
          {showLabels && (
            <text x={CX} y={CY} textAnchor="middle" fontFamily={FONT} fontWeight={700} fill={NAVY}>
              <tspan x={CX} dy={-3} fontSize={17}>{`${el.z}p`}</tspan>
              <tspan x={CX} dy={19} fontSize={17}>{`${neutrons}n`}</tspan>
            </text>
          )}
        </g>

        {/* Electrons: dots, with any gained electrons as crosses (dot-and-cross style). */}
        {dots.map((d, i) => {
          const gold = (lit.has("outer") && d.shell === shells.length - 1) || lit.has("electrons");
          if (d.gained) {
            const c = gold ? GOLD_DARK : CROSS;
            return (
              <g key={`e-${i}`} style={{ filter: gold ? GLOW : undefined }}>
                <circle cx={d.x} cy={d.y} r={9} fill="#fff" />
                <path d={`M${d.x - 6},${d.y - 6} L${d.x + 6},${d.y + 6} M${d.x + 6},${d.y - 6} L${d.x - 6},${d.y + 6}`} stroke={c} strokeWidth={3.2} strokeLinecap="round" />
              </g>
            );
          }
          return (
            <circle
              key={`e-${i}`}
              cx={d.x}
              cy={d.y}
              r={7.5}
              fill={gold ? GOLD : NAVY}
              stroke="#fff"
              strokeWidth={2}
              style={{ filter: gold ? GLOW : undefined }}
            />
          );
        })}

        {/* Ion: square brackets with the charge top right. */}
        {isIon && (
          <g fill="none" stroke={NAVY} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d={`M${bx0 + 16},${by0} H${bx0} V${by1} H${bx0 + 16}`} />
            <path d={`M${bx1 - 16},${by0} H${bx1} V${by1} H${bx1 - 16}`} />
            <text x={bx1 + 6} y={by0 + 22} fontSize={30} fontWeight={700} fill={NAVY} stroke="none" fontFamily={FONT}>
              {chargeLabel(charge)}
            </text>
          </g>
        )}

        {showLabels && (
          <>
            <Label lines={["Nucleus"]} at={[CX - side, nucleusLabelY]} to={nucleusPoint} align="end" />
            {pointAt && <Label lines={electronLines} at={[CX + side, electronLabelY]} to={[pointAt.x, pointAt.y]} align="start" gap={11} />}
            {shells.length > 0 && <Label lines={["Shell"]} at={[CX + side, shellLabelY]} to={shellPoint} align="start" />}
          </>
        )}
      </svg>
      {showLabels && (
        <div className="mt-1 space-y-0.5 text-center text-sm text-navy">
          <p>
            {electrons === 0 ? (
              "No electrons left: the ion is just the nucleus."
            ) : (
              <>
                Electron configuration: <strong className="font-semibold">{isIon ? `[${config}]${ionFormula("", charge)}` : config}</strong>
              </>
            )}
          </p>
          <p className="text-muted">
            {el.z} proton{el.z === 1 ? "" : "s"} · {neutrons} neutron{neutrons === 1 ? "" : "s"} · {electrons} electron{electrons === 1 ? "" : "s"}
            {isIon &&
              (charge > 0
                ? ` (lost ${charge} electron${charge === 1 ? "" : "s"}, so the charge is ${chargeText(charge)})`
                : ` (gained ${gained} electron${gained === 1 ? "" : "s"}, shown as ×, so the charge is ${chargeText(charge)})`)}
          </p>
        </div>
      )}
    </figure>
  );
}

