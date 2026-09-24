"use client";

import { Fragment, useRef, useState, type ReactNode } from "react";
import type { CustomDiagramProps } from "@/lib/diagrams/types";
import { circuitValues, eqSign, fmtNum, pointsAlong, readCircuitOptions, sliderRange } from "@/lib/diagrams/library/physics";
import { DiagramFigure, FONT, GLOW, GOLD, GOLD_TEXT, Label, MUTED, NAVY, Slider, TextButton, useIntegrals, usePrefersReducedMotion } from "./physics-ui";

const W = 640;
const LEFT = 70;
const RIGHT = 570;
/** Centre of the battery and of the ammeter, both on the top (main) wire. */
const BX = 220;
const AX = 420;
const WIRE = 2.5;
/** Charge dots: spacing along the wire, and speed (px/s) for the starting current. */
const DOT_GAP = 24;
const DOT_SPEED = 55;
const MAX_DOT_SPEED = 360;

type Segment = { path: [number, number][]; current: number };

/** R₁-style name with a subscript number. */
function Sub({ letter, n }: { letter: string; n: number }) {
  return (
    <>
      <tspan fontStyle="italic">{letter}</tspan>
      <tspan fontSize="0.72em" dy={3}>
        {n}
      </tspan>
      <tspan dy={-3}>{" "}</tspan>
    </>
  );
}

/** UK cell symbol (long thin plate = +, short thick plate = −); two cells side by side make a battery. */
function Battery({ x, y, cells, glow }: { x: number; y: number; cells: 1 | 2; glow: boolean }) {
  const centres = cells === 1 ? [x] : [x - 14, x + 14];
  return (
    <g style={{ filter: glow ? GLOW : undefined }}>
      {centres.map((c) => (
        <g key={c}>
          <rect x={c - 4} y={y - 22} width={8} height={44} fill="#fff" />
          <rect x={c - 8} y={y - 9} width={6} height={18} fill={glow ? GOLD : NAVY} />
          <rect x={c + 3.7} y={y - 18} width={2.6} height={36} fill={glow ? GOLD : NAVY} />
        </g>
      ))}
      <text x={centres[centres.length - 1] + 14} y={y - 12} fontSize={15} fontWeight={700} fill={NAVY} fontFamily={FONT} textAnchor="middle">
        +
      </text>
      <text x={centres[0] - 14} y={y - 12} fontSize={17} fontWeight={700} fill={NAVY} fontFamily={FONT} textAnchor="middle">
        −
      </text>
    </g>
  );
}

function Ammeter({ x, y, glow }: { x: number; y: number; glow: boolean }) {
  return (
    <g style={{ filter: glow ? GLOW : undefined }}>
      <circle cx={x} cy={y} r={15} fill="#fff" stroke={glow ? GOLD : NAVY} strokeWidth={WIRE} />
      <text x={x} y={y + 5.5} fontSize={16} fontWeight={700} fill={NAVY} fontFamily={FONT} textAnchor="middle">
        A
      </text>
    </g>
  );
}

function Resistor({ x, y, glow }: { x: number; y: number; glow: boolean }) {
  return (
    <rect
      x={x - 32}
      y={y - 11}
      width={64}
      height={22}
      fill="#fff"
      stroke={glow ? GOLD : NAVY}
      strokeWidth={WIRE}
      style={{ filter: glow ? GLOW : undefined }}
    />
  );
}

/** One line of the navy results box. */
function Row({ name, children }: { name: string; children: ReactNode }) {
  return (
    <p>
      <span className="opacity-80">{name}: </span>
      {children}
    </p>
  );
}

/**
 * A series or parallel circuit drawn with UK symbols (battery, ammeter, resistors), sliders for the
 * battery p.d. and each resistance, live totals, and charge dots moving at a speed set by the current.
 */
export function CircuitDiagram({ spec, highlight, mode }: CustomDiagramProps) {
  const start = readCircuitOptions(spec);
  const [voltage, setVoltage] = useState(start.voltage);
  const [resistors, setResistors] = useState(start.resistors);
  const [paused, setPaused] = useState(false);
  const reduced = usePrefersReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);

  const series = start.type === "series";
  const n = resistors.length;
  const result = circuitValues(start.type, voltage, resistors);
  const startCurrent = circuitValues(start.type, start.voltage, start.resistors).current;
  const cells: 1 | 2 = start.voltage <= 2 ? 1 : 2;
  const bw = cells === 1 ? 8 : 22;

  const TOP = series ? 70 : 60;
  const BOTTOM = 220;
  const ys = Array.from({ length: n }, (_, i) => 140 + 74 * i);
  const H = series ? 272 : ys[n - 1] + 58;
  const resistorAt = (i: number): [number, number] => (series ? [LEFT + ((RIGHT - LEFT) * (i + 1)) / (n + 1), BOTTOM] : [320, ys[i]]);

  // Conventional current leaves the + terminal (right of the battery), goes round clockwise and returns to −.
  const segments: Segment[] = series
    ? [{ path: [[BX + bw, TOP], [RIGHT, TOP], [RIGHT, BOTTOM], [LEFT, BOTTOM], [LEFT, TOP], [BX - bw, TOP]], current: result.current }]
    : [
        { path: [[BX + bw, TOP], [RIGHT, TOP], [RIGHT, ys[0]]], current: result.current },
        ...ys.slice(0, -1).flatMap((y, i): Segment[] => {
          const below = result.resistors.slice(i + 1).reduce((s, r) => s + r.current, 0);
          return [
            { path: [[RIGHT, y], [RIGHT, ys[i + 1]]], current: below },
            { path: [[LEFT, ys[i + 1]], [LEFT, y]], current: below },
          ];
        }),
        ...ys.map((y, i): Segment => ({ path: [[RIGHT, y], [LEFT, y]], current: result.resistors[i].current })),
        { path: [[LEFT, ys[0]], [LEFT, TOP], [BX - bw, TOP]], current: result.current },
      ];
  const perAmp = DOT_SPEED / (startCurrent > 0 && Number.isFinite(startCurrent) ? startCurrent : 1);
  const showDots = !reduced;
  const flows = useIntegrals(
    segments.map((s) => Math.min(MAX_DOT_SPEED, s.current * perAmp)),
    showDots && !paused,
    svgRef,
  );

  const hl = new Set(highlight.map((h) => h.trim().toLowerCase()));
  const batteryOn = ["battery", "cell", "power supply", "supply"].some((k) => hl.has(k));
  const ammeterOn = hl.has("ammeter");
  const resistorOn = (i: number) => hl.has(`r${i + 1}`) || hl.has("resistor") || hl.has("resistors");
  const showText = mode !== "blank";
  const answers = start.controls && showText;

  const wires = series
    ? `M${LEFT},${TOP} H${RIGHT} V${BOTTOM} H${LEFT} Z`
    : `M${LEFT},${ys[n - 1]} V${TOP} H${RIGHT} V${ys[n - 1]} ${ys.map((y) => `M${LEFT},${y} H${RIGHT}`).join(" ")}`;
  const changed = voltage !== start.voltage || resistors.some((r, i) => r !== start.resistors[i]);
  const title = series ? "Series circuit" : "Parallel circuit";
  const rList = resistors.map((r, i) => `R${i + 1} = ${fmtNum(r)} Ω`).join(", ");
  const invSum = resistors.reduce((s, r) => s + 1 / r, 0);

  return (
    <DiagramFigure title={title}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full select-none"
        role="img"
        aria-label={`${title}: a ${fmtNum(voltage)} V ${cells === 1 ? "cell" : "battery"}, an ammeter in the main wire, and ${n === 1 ? "a resistor" : `${n} resistors ${series ? "in series" : "in parallel"}`}: ${rList}.`}
      >
        <path d={wires} fill="none" stroke={NAVY} strokeWidth={WIRE} strokeLinejoin="miter" strokeLinecap="square" />
        {showDots &&
          segments.map((s, i) =>
            pointsAlong(s.path, flows[i] ?? 0, DOT_GAP).map(([x, y], j) => (
              <circle key={`${i}-${j}`} cx={x} cy={y} r={3.4} fill={GOLD} stroke="#fff" strokeWidth={1} />
            )),
          )}
        {!series &&
          ys.slice(0, -1).map((y) => (
            <Fragment key={y}>
              <circle cx={LEFT} cy={y} r={4.5} fill={NAVY} />
              <circle cx={RIGHT} cy={y} r={4.5} fill={NAVY} />
            </Fragment>
          ))}
        <Battery x={BX} y={TOP} cells={cells} glow={batteryOn} />
        <Ammeter x={AX} y={TOP} glow={ammeterOn} />
        {/* direction of conventional current in the main wire */}
        <polygon points={`${506},${TOP} ${495},${TOP - 6} ${495},${TOP + 6}`} fill={NAVY} />
        {resistors.map((_, i) => {
          const [x, y] = resistorAt(i);
          return <Resistor key={i} x={x} y={y} glow={resistorOn(i)} />;
        })}

        {showText && (
          <g>
            <Label x={BX} y={TOP - 28} weight={700} colour={batteryOn ? GOLD_TEXT : NAVY}>
              {fmtNum(voltage)} V
            </Label>
            <Label x={500} y={TOP - 12} size={13} colour={MUTED}>
              <tspan fontStyle="italic">I</tspan>
            </Label>
            {answers && (
              <Label x={AX} y={TOP - 24} weight={700} colour={ammeterOn ? GOLD_TEXT : NAVY}>
                {fmtNum(result.current)} A
              </Label>
            )}
            {resistors.map((r, i) => {
              const [x, y] = resistorAt(i);
              const on = resistorOn(i);
              const part = result.resistors[i];
              return (
                <g key={i}>
                  <Label x={x} y={y - 19} weight={on ? 700 : 600} colour={on ? GOLD_TEXT : NAVY}>
                    <Sub letter="R" n={i + 1} />= {fmtNum(r)} Ω
                  </Label>
                  {answers && (
                    <Label x={x} y={y + 30} size={12} colour={MUTED}>
                      {series ? (
                        <>
                          p.d. = {fmtNum(part.pd)} V
                        </>
                      ) : (
                        <>
                          <Sub letter="I" n={i + 1} />= {fmtNum(part.current)} A
                        </>
                      )}
                    </Label>
                  )}
                </g>
              );
            })}
          </g>
        )}
      </svg>

      {start.controls && (
        <div className="mt-2 grid gap-3 rounded-lg bg-paper p-3 sm:grid-cols-2">
          <Slider
            label={
              <>
                Battery p.d. <em>V</em>
              </>
            }
            name="battery potential difference"
            value={voltage}
            unit="V"
            range={sliderRange(start.voltage, 0, Math.max(12, start.voltage), 24)}
            onChange={setVoltage}
          />
          {resistors.map((r, i) => (
            <Slider
              key={i}
              label={
                <>
                  <em>R</em>
                  <sub>{i + 1}</sub>
                </>
              }
              name={`resistance R${i + 1}`}
              value={r}
              unit="Ω"
              range={sliderRange(start.resistors[i], Math.min(1, start.resistors[i]), Math.max(20, start.resistors[i]), 19)}
              onChange={(v) => setResistors((rs) => rs.map((old, j) => (j === i ? v : old)))}
            />
          ))}
        </div>
      )}

      {answers && (
        <div className="mt-2 space-y-1 rounded-lg bg-navy px-4 py-3 text-sm text-white" aria-live="polite">
          {series ? (
            <>
              <Row name="Total resistance">
                <em>R</em> = {resistors.map(fmtNum).join(" + ")} {eqSign(result.totalResistance)}{" "}
                <strong className="text-base">{fmtNum(result.totalResistance)} Ω</strong>
              </Row>
              <Row name="Current">
                <em>I</em> = <em>V</em> ÷ <em>R</em> = {fmtNum(voltage)} ÷ {fmtNum(result.totalResistance)} {eqSign(result.current)}{" "}
                <strong className="text-base">{fmtNum(result.current)} A</strong>, the same all the way round
              </Row>
              <Row name="p.d. across each resistor (V = I × R)">
                {result.resistors.map((p, i) => (
                  <span key={i}>
                    {i > 0 && ", "}
                    <em>V</em>
                    <sub>{i + 1}</sub> = {fmtNum(result.current)} × {fmtNum(p.resistance)} {eqSign(p.pd)} <strong>{fmtNum(p.pd)} V</strong>
                  </span>
                ))}
                {n > 1 && <span className="text-gold-300">, which add up to the battery&apos;s {fmtNum(voltage)} V</span>}
              </Row>
            </>
          ) : (
            <>
              <Row name="Total resistance">
                1/<em>R</em> = {resistors.map((r) => `1/${fmtNum(r)}`).join(" + ")} {eqSign(invSum)} {fmtNum(invSum)}, so <em>R</em>{" "}
                {eqSign(result.totalResistance)} <strong className="text-base">{fmtNum(result.totalResistance)} Ω</strong>
                {n > 1 && <span className="text-gold-300"> (less than the smallest resistor)</span>}
              </Row>
              <Row name="Branch currents (I = V ÷ R)">
                {result.resistors.map((p, i) => (
                  <span key={i}>
                    {i > 0 && ", "}
                    <em>I</em>
                    <sub>{i + 1}</sub> = {fmtNum(voltage)} ÷ {fmtNum(p.resistance)} {eqSign(p.current)} <strong>{fmtNum(p.current)} A</strong>
                  </span>
                ))}
              </Row>
              <Row name="Total current">
                <em>I</em> = {result.resistors.map((p) => fmtNum(p.current)).join(" + ")} {eqSign(result.current)}{" "}
                <strong className="text-base">{fmtNum(result.current)} A</strong> (the ammeter reading)
              </Row>
              <Row name="p.d.">
                <strong>{fmtNum(voltage)} V</strong> across every branch, the same as the battery
              </Row>
            </>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <p className="max-w-prose text-xs text-muted">
          {series
            ? "Series: one loop, so the current is the same everywhere. The battery's p.d. is shared between the resistors, and the bigger resistance gets the bigger share."
            : "Parallel: every branch gets the full p.d. of the battery, and the branch currents add up to the total current. Adding a branch lowers the total resistance."}
          {showDots && " The moving dots show conventional current, from + to −: faster dots mean a bigger current."}
        </p>
        <div className="flex gap-3">
          {showDots && <TextButton onClick={() => setPaused((p) => !p)}>{paused ? "Play" : "Pause"}</TextButton>}
          {changed && (
            <TextButton
              onClick={() => {
                setVoltage(start.voltage);
                setResistors(start.resistors);
              }}
            >
              Reset
            </TextButton>
          )}
        </div>
      </div>
    </DiagramFigure>
  );
}
