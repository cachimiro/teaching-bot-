"use client";

import { useState, type ReactNode } from "react";
import type { CustomDiagramProps } from "@/lib/diagrams/types";
import {
  acceleration,
  eqSign,
  fmtNum,
  readForcesOptions,
  resultantForce,
  sliderRange,
  type Direction,
  type Force,
  type ForceObject,
} from "@/lib/diagrams/library/physics";
import { Arrow, BLUE, DiagramFigure, GLOW, GOLD, GOLD_TEXT, Label, MUTED, NAVY, Slider, TextButton } from "./physics-ui";

const W = 640;
const CX = 320;
/** Longest arrow, in px. The biggest starting force is drawn at 80% of this, leaving room to grow. */
const L_MAX = 150;
/** Height of the "Resultant force" strip under the drawing. */
const STRIP = 48;

/** Half-width and half-height of each drawing, so labels of short arrows sit outside the object. */
const HALF: Record<ForceObject, { w: number; h: number }> = {
  car: { w: 50, h: 26 },
  box: { w: 36, h: 36 },
  skydiver: { w: 30, h: 44 },
  rocket: { w: 26, h: 57 },
  ball: { w: 30, h: 30 },
};

const UNIT: Record<Direction, [number, number]> = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] };

/** A simple, clear drawing of each object, centred on (0, 0). */
function ObjectShape({ object, thrust }: { object: ForceObject; thrust: boolean }) {
  switch (object) {
    case "car":
      return (
        <g transform="translate(0 3)">
          <path d="M-28,-10 L-16,-28 L14,-28 L30,-10 Z" fill="#cddcf2" stroke={NAVY} strokeWidth={2.5} strokeLinejoin="round" />
          <rect x={-50} y={-11} width={100} height={23} rx={7} fill="#cddcf2" stroke={NAVY} strokeWidth={2.5} />
          <path d="M-22,-13 L-14,-25 L-2,-25 L-2,-13 Z M2,-13 L2,-25 L12,-25 L23,-13 Z" fill="#fff" stroke={NAVY} strokeWidth={1.5} strokeLinejoin="round" />
          {[-28, 28].map((x) => (
            <g key={x}>
              <circle cx={x} cy={12} r={10} fill={NAVY} />
              <circle cx={x} cy={12} r={3.5} fill="#fff" />
            </g>
          ))}
        </g>
      );
    case "box":
      return (
        <g>
          <rect x={-36} y={-36} width={72} height={72} rx={3} fill="#f3e3c3" stroke={NAVY} strokeWidth={2.5} />
          <rect x={-36} y={-6} width={72} height={12} fill="#e4cc98" />
          <rect x={-36} y={-36} width={72} height={72} rx={3} fill="none" stroke={NAVY} strokeWidth={2.5} />
        </g>
      );
    case "skydiver":
      return (
        <g strokeLinecap="round">
          <path d="M-6,-18 L-26,-38 M6,-18 L26,-38" stroke={BLUE} strokeWidth={6} />
          <path d="M-4,8 L-15,40 M4,8 L15,40" stroke={BLUE} strokeWidth={7} />
          <rect x={-9} y={-22} width={18} height={33} rx={7} fill={BLUE} stroke={NAVY} strokeWidth={2} />
          <circle cx={0} cy={-32} r={9} fill="#f6d3b3" stroke={NAVY} strokeWidth={2} />
          <path d="M-8,-35 Q0,-45 8,-35" fill="#8fa9d9" stroke={NAVY} strokeWidth={1.5} />
        </g>
      );
    case "rocket":
      return (
        <g transform="translate(0 9)">
          {thrust && <path d="M-7,40 Q0,64 7,40 Z" fill="#f5c26b" stroke="#d98b2b" strokeWidth={1.5} />}
          <path d="M-14,12 L-27,38 L-14,33 Z M14,12 L27,38 L14,33 Z" fill="#f0b3ac" stroke={NAVY} strokeWidth={2} strokeLinejoin="round" />
          <rect x={-14} y={-36} width={28} height={70} fill="#e8edf5" stroke={NAVY} strokeWidth={2.5} />
          <path d="M-14,-36 Q-12,-56 0,-66 Q12,-56 14,-36 Z" fill="#f0b3ac" stroke={NAVY} strokeWidth={2.5} strokeLinejoin="round" />
          <circle cx={0} cy={-14} r={6.5} fill="#cddcf2" stroke={NAVY} strokeWidth={2} />
          <rect x={-8} y={34} width={16} height={6} fill={NAVY} />
        </g>
      );
    case "ball":
      return (
        <g>
          <circle r={30} fill="#fbd7b0" stroke={NAVY} strokeWidth={2.5} />
          <path d="M-22,-20 Q-4,0 -22,20 M22,-20 Q4,0 22,20" fill="none" stroke="#d98b2b" strokeWidth={1.8} />
          <circle cx={-10} cy={-12} r={6} fill="#fff" opacity={0.55} />
        </g>
      );
  }
}

function Row({ name, children }: { name: string; children: ReactNode }) {
  return (
    <p>
      <span className="opacity-80">{name}: </span>
      {children}
    </p>
  );
}

/** "Horizontal: 500 N right − 300 N left = 200 N to the right" style working for one axis. */
function axisWorking(forces: Force[], pos: Direction, neg: Direction, net: number, words: [string, string]): string | null {
  const a = forces.filter((f) => f.direction === pos);
  const b = forces.filter((f) => f.direction === neg);
  if (!a.length && !b.length) return null;
  const side = (fs: Force[], dir: Direction) => {
    const total = fs.reduce((s, f) => s + f.size, 0);
    return `${fs.length > 1 ? `(${fs.map((f) => fmtNum(f.size)).join(" + ")}) = ` : ""}${fmtNum(total)} N ${dir}`;
  };
  const result = net === 0 ? "0 N (balanced)" : `${fmtNum(Math.abs(net))} N ${net > 0 ? words[0] : words[1]}`;
  if (a.length && b.length) return `${side(a, pos)}, ${side(b, neg)}, so ${fmtNum(a.reduce((s, f) => s + f.size, 0))} − ${fmtNum(b.reduce((s, f) => s + f.size, 0))} = ${result}`;
  return `${side(a.length ? a : b, a.length ? pos : neg)}, so ${result}`;
}

/**
 * A free-body diagram: an object with force arrows from its centre (length proportional to size), a
 * slider per force, and the resultant force with what it means (and a = F / m when the mass is given).
 */
export function ForcesDiagram({ spec, highlight, mode }: CustomDiagramProps) {
  const start = readForcesOptions(spec);
  const [sizes, setSizes] = useState(() => start.forces.map((f) => f.size));
  const forces = start.forces.map((f, i) => ({ ...f, size: sizes[i] ?? f.size }));
  const r = resultantForce(forces);

  const startMax = Math.max(...start.forces.map((f) => f.size)) || 100;
  const pxPerN = L_MAX / Math.max(1.25 * startMax, ...forces.map((f) => f.size));
  const half = HALF[start.object];
  const hl = new Set(highlight.map((h) => h.trim().toLowerCase()));
  const showText = mode !== "blank";
  const answers = start.controls && showText;
  const resultantOn = hl.has("resultant") || hl.has("resultant force");
  const thrust = forces.some((f) => /thrust/i.test(f.label) && f.size > 0);
  const title = `Forces on a ${start.object}`;

  // Only leave room above and below the object for the directions that are actually used.
  const has = (d: Direction) => forces.some((f) => f.direction === d);
  const CY = 6 + (has("up") ? L_MAX + 38 : half.h + 28);
  const stripY = CY + (has("down") ? L_MAX + 46 : half.h + 28);
  const H = stripY + (answers ? STRIP : 0);

  // Forces sharing a direction are drawn side by side.
  const groups: Record<Direction, number[]> = { left: [], right: [], up: [], down: [] };
  forces.forEach((f, i) => groups[f.direction].push(i));

  const arrows = forces.map((f, i) => {
    const group = groups[f.direction];
    const k = group.indexOf(i);
    const m = group.length;
    const horizontal = f.direction === "left" || f.direction === "right";
    const offset = (k - (m - 1) / 2) * (horizontal ? 24 : 30);
    const [ux, uy] = UNIT[f.direction];
    const sx = CX + (horizontal ? 0 : offset);
    const sy = CY + (horizontal ? offset : 0);
    const len = f.size * pxPerN;
    const on = hl.has(f.label.toLowerCase());
    const colour = on ? GOLD : NAVY;
    const textColour = on ? GOLD_TEXT : NAVY;
    // Labels go beyond the arrow tip, or just outside the object for short arrows.
    const reach = Math.max(len, (horizontal ? half.w : half.h) + 10);
    const tx = sx + ux * reach;
    const ty = sy + uy * reach;
    let label: ReactNode = null;
    if (showText) {
      if (m === 1 && horizontal) {
        const anchor = ux > 0 ? "start" : "end";
        label = (
          <>
            <Label x={tx + ux * 8} y={ty - 3} anchor={anchor} weight={on ? 700 : 600} colour={textColour}>
              {f.label}
            </Label>
            <Label x={tx + ux * 8} y={ty + 13} anchor={anchor} colour={textColour}>
              {fmtNum(f.size)} N
            </Label>
          </>
        );
      } else if (m === 1) {
        const y1 = uy < 0 ? ty - 24 : ty + 18;
        label = (
          <>
            <Label x={tx} y={y1} weight={on ? 700 : 600} colour={textColour}>
              {f.label}
            </Label>
            <Label x={tx} y={y1 + 16} colour={textColour}>
              {fmtNum(f.size)} N
            </Label>
          </>
        );
      } else {
        const side = k - (m - 1) / 2;
        const anchor = horizontal ? (ux > 0 ? "start" : "end") : side < 0 ? "end" : side > 0 ? "start" : "middle";
        const lx = horizontal ? tx + ux * 8 : tx + Math.sign(side) * 8;
        const ly = horizontal ? ty + 4 : side === 0 ? ty + (uy < 0 ? -8 : 16) : ty + 4;
        label = (
          <Label x={lx} y={ly} anchor={anchor} weight={on ? 700 : 600} colour={textColour}>
            {f.label} {fmtNum(f.size)} N
          </Label>
        );
      }
    }
    return (
      <g key={i}>
        <g style={{ filter: on ? GLOW : undefined }}>
          <Arrow x1={sx} y1={sy} x2={sx + ux * len} y2={sy + uy * len} colour={colour} width={4} head={14} />
        </g>
        {label}
      </g>
    );
  });

  const both = r.x !== 0 && r.y !== 0;
  // Draw the diagonal resultant on the object only when it is well clear of the other arrows and their labels.
  const drawDiagonal = both && r.angle >= 20 && r.angle <= 70;
  const rx = CX + r.x * pxPerN;
  const ry = CY - r.y * pxPerN;
  const ru = r.balanced ? [0, 0] : [r.x / r.size, -r.y / r.size];
  const stripArrowX = CX - 26;
  const stripMidY = stripY + STRIP / 2 + 2;
  const a = start.mass ? acceleration(r.size, start.mass) : null;
  const changed = sizes.some((s, i) => s !== start.forces[i].size);

  return (
    <DiagramFigure title={title}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full select-none"
        role="img"
        aria-label={`${title}: ${forces.map((f) => `${f.label} ${fmtNum(f.size)} N ${f.direction === "up" || f.direction === "down" ? `${f.direction}wards` : `to the ${f.direction}`}`).join(", ")}.`}
      >
        <g transform={`translate(${CX} ${CY})`} opacity={0.95}>
          <ObjectShape object={start.object} thrust={thrust} />
        </g>
        {answers && drawDiagonal && (
          <g style={{ filter: resultantOn ? GLOW : undefined }}>
            <Arrow x1={CX} y1={CY} x2={rx} y2={ry} colour={GOLD} width={3.5} head={14} dash="8 5" />
            <Label x={rx + (r.x > 0 ? 10 : -10)} y={ry + (r.y > 0 ? -6 : 16)} anchor={r.x > 0 ? "start" : "end"} weight={700} colour={GOLD_TEXT}>
              Resultant {fmtNum(r.size)} N
            </Label>
          </g>
        )}
        {arrows}
        <circle cx={CX} cy={CY} r={4} fill={NAVY} stroke="#fff" strokeWidth={1.5} />

        {start.mass !== null && showText && (
          <Label x={W - 12} y={18} anchor="end" size={12} colour={MUTED}>
            mass = {fmtNum(start.mass)} kg
          </Label>
        )}
        {/* the resultant, in a strip under the drawing */}
        {answers && (
          <g>
            <rect x={12} y={stripY + 4} width={W - 24} height={STRIP - 8} rx={8} fill="#faf6ec" />
            <Label x={stripArrowX - 30} y={stripMidY + 5} anchor="end" weight={700} halo={false}>
              Resultant force
            </Label>
            <g style={{ filter: resultantOn ? GLOW : undefined }}>
              {r.balanced ? (
                <circle cx={stripArrowX} cy={stripMidY} r={5} fill={NAVY} />
              ) : (
                <Arrow
                  x1={stripArrowX - ru[0] * 16}
                  y1={stripMidY - ru[1] * 16}
                  x2={stripArrowX + ru[0] * 16}
                  y2={stripMidY + ru[1] * 16}
                  colour={GOLD}
                  width={4}
                  head={12}
                />
              )}
            </g>
            <Label x={stripArrowX + 30} y={stripMidY + 5} anchor="start" weight={700} colour={GOLD_TEXT} halo={false}>
              {fmtNum(r.size)} N {r.balanced ? "(balanced)" : r.direction}
            </Label>
          </g>
        )}
      </svg>

      {start.controls && (
        <div className="mt-2 grid gap-3 rounded-lg bg-paper p-3 sm:grid-cols-2">
          {forces.map((f, i) => (
            <Slider
              key={i}
              label={
                <>
                  {f.label} <span className="text-muted">({f.direction === "up" || f.direction === "down" ? `${f.direction}wards` : f.direction})</span>
                </>
              }
              name={`${f.label} force`}
              value={f.size}
              unit="N"
              range={sliderRange(start.forces[i].size, 0, 2 * startMax)}
              onChange={(v) => setSizes((s) => s.map((old, j) => (j === i ? v : old)))}
            />
          ))}
        </div>
      )}

      {answers && (
        <div className="mt-2 space-y-1 rounded-lg bg-navy px-4 py-3 text-sm text-white" aria-live="polite">
          {(
            [
              ["Horizontal", axisWorking(forces, "right", "left", r.x, ["to the right", "to the left"])],
              ["Vertical", axisWorking(forces, "up", "down", r.y, ["upwards", "downwards"])],
            ] as const
          ).map(([name, text]) =>
            text ? (
              <Row key={name} name={name}>
                {text}
              </Row>
            ) : null,
          )}
          {both && (
            <Row name="Two directions, so use Pythagoras">
              √({fmtNum(Math.abs(r.x))}² + {fmtNum(Math.abs(r.y))}²) {eqSign(r.size)} {fmtNum(r.size)} N, at {fmtNum(r.angle, 2)}°{" "}
              {r.y > 0 ? "above" : "below"} the horizontal
            </Row>
          )}
          <p className="text-lg font-bold">
            Resultant force {eqSign(r.size)} {fmtNum(r.size)} N{r.balanced ? "" : ` ${r.direction}`}
          </p>
          <p className="text-gold-300">
            {r.balanced
              ? "The forces are balanced: the object is either stationary or moving at a constant velocity (steady speed in a straight line)."
              : "The forces are unbalanced: the object accelerates in the direction of the resultant force, so it speeds up, slows down or changes direction."}
          </p>
          {a !== null && (
            <Row name="Acceleration (F = m × a)">
              <em>a</em> = <em>F</em> ÷ <em>m</em> = {fmtNum(r.size)} ÷ {fmtNum(start.mass!)} {eqSign(a)} <strong className="text-base">{fmtNum(a)} m/s²</strong>
            </Row>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <p className="max-w-prose text-xs text-muted">Each arrow starts at the centre of the object; its length shows the size of the force.</p>
        {changed && <TextButton onClick={() => setSizes(start.forces.map((f) => f.size))}>Reset</TextButton>}
      </div>
    </DiagramFigure>
  );
}
