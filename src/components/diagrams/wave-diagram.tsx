"use client";

import { useRef, useState } from "react";
import type { CustomDiagramProps } from "@/lib/diagrams/types";
import { eqSign, fmtNum, readWaveOptions, ridingLabel, sliderRange, waveDisplacement, waveSpeed } from "@/lib/diagrams/library/physics";
import {
  Arrow,
  BLUE,
  DiagramFigure,
  GLOW,
  GOLD,
  GOLD_TEXT,
  GUIDE,
  Label,
  MUTED,
  NAVY,
  Slider,
  TextButton,
  useIntegrals,
  usePrefersReducedMotion,
} from "./physics-ui";

const W = 680;
/** The wave is drawn between X0 and X1; the right-hand margin holds the amplitude and rest-position labels. */
const X0 = 24;
const X1 = 536;
const PW = X1 - X0;
/** Real waves are often far too fast to follow: the starting frequency is shown at most this many cycles a second. */
const MAX_VISUAL_HZ = 0.5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Fades a riding label out as it reaches either end of the wave. */
const edgeFade = (x: number) => clamp(Math.min(x - X0, X1 - x) / 24, 0, 1);

type Scene = {
  amplitude: number;
  wavelength: number;
  cycles: number;
  /** Pixels per metre (fixed for the diagram, so the wavelength slider visibly stretches the wave). */
  pxPerM: number;
  aMax: number;
  lMin: number;
  hl: Set<string>;
  showText: boolean;
};

const isOn = (hl: Set<string>, ...names: string[]) => names.some((n) => hl.has(n));

function TransverseScene({ amplitude, wavelength, cycles, pxPerM, aMax, hl, showText }: Scene) {
  const REST = 138;
  const lpx = wavelength * pxPerM;
  const waves = PW / lpx;
  const apx = (amplitude / aMax) * 80;
  const yAt = (x: number) => REST - waveDisplacement(x - X0, apx, lpx, cycles);
  let path = "";
  for (let x = X0; x <= X1 + 0.01; x += 2) path += `${path ? "L" : "M"}${x.toFixed(1)},${yAt(x).toFixed(1)}`;

  // Fixed wavelength marker, crest to crest at the start (the crests pass through it as the wave moves).
  const bx1 = X0 + 0.25 * lpx;
  const bx2 = bx1 + lpx;
  const by = Math.max(30, REST - apx - 22);
  // Crest and trough labels ride along with the wave, handing over smoothly from one crest to the next.
  const crest = ridingLabel(clamp(Math.round(0.7 * waves - 0.25), 2, Math.floor(waves - 0.55)) + 0.25, "crest", cycles);
  const trough = ridingLabel(clamp(Math.round(0.45 * waves - 0.75), 0, Math.floor(waves - 1.05)) + 0.75, "trough", cycles);
  const crestX = X0 + crest.at * lpx;
  const troughX = X0 + trough.at * lpx;
  const XA = 556;

  const amp = isOn(hl, "amplitude");
  const wl = isOn(hl, "wavelength");
  const crestOn = isOn(hl, "crest", "crests", "peak");
  const troughOn = isOn(hl, "trough", "troughs");
  const restOn = isOn(hl, "rest position", "undisturbed position", "rest", "equilibrium", "equilibrium position");

  return (
    <g>
      {/* crest and trough levels, and the undisturbed (rest) position */}
      <line x1={X0} x2={XA + 6} y1={REST - apx} y2={REST - apx} stroke={GUIDE} strokeWidth={1.2} strokeDasharray="2 4" />
      <line x1={X0} x2={X1} y1={REST + apx} y2={REST + apx} stroke={GUIDE} strokeWidth={1.2} strokeDasharray="2 4" />
      <line
        x1={X0}
        x2={XA + 6}
        y1={REST}
        y2={REST}
        stroke={restOn ? GOLD : MUTED}
        strokeWidth={restOn ? 2 : 1.3}
        strokeDasharray="7 5"
        style={{ filter: restOn ? GLOW : undefined }}
      />
      {/* wavelength marker and its guides */}
      <line x1={bx1} x2={bx1} y1={by + 4} y2={REST + apx + 4} stroke={GUIDE} strokeWidth={1.2} strokeDasharray="3 3" />
      <line x1={bx2} x2={bx2} y1={by + 4} y2={REST + apx + 4} stroke={GUIDE} strokeWidth={1.2} strokeDasharray="3 3" />
      <g style={{ filter: wl ? GLOW : undefined }}>
        <Arrow x1={bx1} y1={by} x2={bx2} y2={by} double head={8} width={wl ? 2.4 : 1.8} colour={wl ? GOLD : NAVY} />
      </g>
      {/* the wave */}
      <path d={path} fill="none" stroke={NAVY} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      {/* the same point on neighbouring waves: they always move together */}
      <circle cx={bx1} cy={yAt(bx1)} r={4.5} fill={BLUE} stroke="#fff" strokeWidth={1.5} />
      <circle cx={bx2} cy={yAt(bx2)} r={4.5} fill={BLUE} stroke="#fff" strokeWidth={1.5} />
      {/* amplitude: from the rest position to the height of a crest */}
      <g style={{ filter: amp ? GLOW : undefined }}>
        <Arrow x1={XA} y1={REST} x2={XA} y2={REST - apx} double head={8} width={amp ? 2.4 : 1.8} colour={amp ? GOLD : NAVY} />
      </g>
      {showText && (
        <g>
          <Label x={(bx1 + bx2) / 2} y={by - 8} colour={wl ? GOLD_TEXT : NAVY} weight={wl ? 700 : 600}>
            wavelength = {fmtNum(wavelength)} m
          </Label>
          <Label x={XA + 10} y={Math.min(REST - apx / 2 - 3, REST - 22)} anchor="start" colour={amp ? GOLD_TEXT : NAVY} weight={amp ? 700 : 600}>
            amplitude
          </Label>
          <Label x={XA + 10} y={Math.min(REST - apx / 2 - 3, REST - 22) + 15} anchor="start" colour={amp ? GOLD_TEXT : NAVY} weight={amp ? 700 : 600}>
            = {fmtNum(amplitude)} m
          </Label>
          <Label x={X1 + 8} y={REST + 17} anchor="start" size={12} colour={restOn ? GOLD_TEXT : MUTED} weight={restOn ? 700 : 500}>
            undisturbed
          </Label>
          <Label x={X1 + 8} y={REST + 31} anchor="start" size={12} colour={restOn ? GOLD_TEXT : MUTED} weight={restOn ? 700 : 500}>
            (rest) position
          </Label>
          <Label x={crestX} y={REST - apx - 10} colour={crestOn ? GOLD_TEXT : NAVY} weight={crestOn ? 700 : 600} opacity={crest.opacity * edgeFade(crestX)}>
            crest
          </Label>
          <Label x={troughX} y={REST + apx + 20} colour={troughOn ? GOLD_TEXT : NAVY} weight={troughOn ? 700 : 600} opacity={trough.opacity * edgeFade(troughX)}>
            trough
          </Label>
        </g>
      )}
      <Arrow x1={X0} y1={254} x2={X0 + 64} y2={254} colour={MUTED} width={2} head={9} />
      {showText && (
        <Label x={X0 + 74} y={258} anchor="start" size={12} colour={MUTED}>
          direction the wave travels (energy transfer)
        </Label>
      )}
    </g>
  );
}

function LongitudinalScene({ amplitude, wavelength, cycles, pxPerM, aMax, lMin, hl, showText }: Scene) {
  const TOP = 60;
  const BOTTOM = 150;
  const lpx = wavelength * pxPerM;
  const waves = PW / lpx;
  // Line spacing and amplitude are set by the shortest wavelength on the slider, so lines never cross.
  const lpxMin = lMin * pxPerM;
  const spacing = clamp(lpxMin / 14, 3.5, 8);
  const apx = (amplitude / aMax) * 0.95 * (lpxMin / (2 * Math.PI));
  const count = Math.floor(PW / spacing);
  const tracked = clamp(Math.round((PW - 0.6 * lpx - spacing / 2) / spacing), 0, count - 1);
  const restX = (i: number) => X0 + spacing / 2 + i * spacing;
  const xAt = (i: number) => restX(i) + waveDisplacement(restX(i) - X0, apx, lpx, cycles);

  const bx1 = X0 + 0.5 * lpx;
  const bx2 = bx1 + lpx;
  const by = TOP - 18;
  const k = clamp(Math.round(0.25 * waves - 0.5), 0, Math.floor(waves - 2.3));
  const compression = ridingLabel(k + 0.5, "compression", cycles);
  const rarefaction = ridingLabel(k + 2, "rarefaction", cycles);
  const cX = X0 + compression.at * lpx;
  const rX = X0 + rarefaction.at * lpx;
  const tX = restX(tracked);

  const amp = isOn(hl, "amplitude");
  const wl = isOn(hl, "wavelength");
  const cOn = isOn(hl, "compression", "compressions");
  const rOn = isOn(hl, "rarefaction", "rarefactions");

  return (
    <g>
      <line x1={bx1} x2={bx1} y1={by + 4} y2={BOTTOM + 2} stroke={GUIDE} strokeWidth={1.2} strokeDasharray="3 3" />
      <line x1={bx2} x2={bx2} y1={by + 4} y2={BOTTOM + 2} stroke={GUIDE} strokeWidth={1.2} strokeDasharray="3 3" />
      <g style={{ filter: wl ? GLOW : undefined }}>
        <Arrow x1={bx1} y1={by} x2={bx2} y2={by} double head={8} width={wl ? 2.4 : 1.8} colour={wl ? GOLD : NAVY} />
      </g>
      {Array.from({ length: count }, (_, i) =>
        i === tracked ? null : <line key={i} x1={xAt(i)} x2={xAt(i)} y1={TOP} y2={BOTTOM} stroke={NAVY} strokeWidth={2} />,
      )}
      {/* one particle, and its rest position: it only moves back and forth */}
      <line x1={tX} x2={tX} y1={TOP - 6} y2={BOTTOM + 6} stroke={BLUE} strokeWidth={1.3} strokeDasharray="3 3" />
      <line x1={xAt(tracked)} x2={xAt(tracked)} y1={TOP} y2={BOTTOM} stroke={BLUE} strokeWidth={3.4} />
      <g stroke={amp ? GOLD : NAVY} strokeWidth={amp ? 2.4 : 1.8} style={{ filter: amp ? GLOW : undefined }}>
        <line x1={tX} x2={tX + apx} y1={TOP - 12} y2={TOP - 12} />
        <line x1={tX} x2={tX} y1={TOP - 16} y2={TOP - 8} />
        <line x1={tX + apx} x2={tX + apx} y1={TOP - 16} y2={TOP - 8} />
      </g>
      {showText && (
        <g>
          <Label x={(bx1 + bx2) / 2} y={by - 8} colour={wl ? GOLD_TEXT : NAVY} weight={wl ? 700 : 600}>
            wavelength = {fmtNum(wavelength)} m
          </Label>
          <Label x={tX + apx / 2} y={TOP - 22} colour={amp ? GOLD_TEXT : NAVY} weight={amp ? 700 : 600}>
            amplitude = {fmtNum(amplitude)} m
          </Label>
          <g opacity={compression.opacity * edgeFade(cX)}>
            <line x1={cX} x2={cX} y1={BOTTOM + 5} y2={BOTTOM + 11} stroke={cOn ? GOLD : NAVY} strokeWidth={1.5} />
            <Label x={cX} y={BOTTOM + 25} colour={cOn ? GOLD_TEXT : NAVY} weight={cOn ? 700 : 600}>
              compression
            </Label>
          </g>
          <g opacity={rarefaction.opacity * edgeFade(rX)}>
            <line x1={rX} x2={rX} y1={BOTTOM + 5} y2={BOTTOM + 11} stroke={rOn ? GOLD : NAVY} strokeWidth={1.5} />
            <Label x={rX} y={BOTTOM + 25} colour={rOn ? GOLD_TEXT : NAVY} weight={rOn ? 700 : 600}>
              rarefaction
            </Label>
          </g>
        </g>
      )}
      <Arrow x1={X0} y1={BOTTOM + 50} x2={X0 + 64} y2={BOTTOM + 50} colour={MUTED} width={2} head={9} />
      {showText && (
        <Label x={X0 + 74} y={BOTTOM + 54} anchor="start" size={12} colour={MUTED}>
          direction the wave travels (energy transfer)
        </Label>
      )}
    </g>
  );
}

/**
 * A travelling transverse or longitudinal wave with labelled amplitude and wavelength, sliders for
 * amplitude, wavelength and frequency, and a live v = f × λ readout.
 */
export function WaveDiagram({ spec, highlight, mode }: CustomDiagramProps) {
  const start = readWaveOptions(spec);
  const [amplitude, setAmplitude] = useState(start.amplitude);
  const [wavelength, setWavelength] = useState(start.wavelength);
  const [frequency, setFrequency] = useState(start.frequency);
  const [paused, setPaused] = useState(false);
  const reduced = usePrefersReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);

  const longitudinal = start.type === "longitudinal";
  const aRange = sliderRange(start.amplitude, start.amplitude / 4, start.amplitude * (longitudinal ? 1.25 : 1.5));
  const lRange = sliderRange(start.wavelength, start.wavelength * (longitudinal ? 0.75 : 0.5), start.wavelength * 1.5);
  const fRange = sliderRange(start.frequency, start.frequency / 4, start.frequency * 3);
  const timeScale = Math.min(1, MAX_VISUAL_HZ / start.frequency);
  const [cycles = 0] = useIntegrals([frequency * timeScale], !reduced && !paused, svgRef);

  const showText = mode !== "blank";
  const scene: Scene = {
    amplitude,
    wavelength,
    cycles,
    pxPerM: PW / (4 * start.wavelength),
    aMax: aRange.max,
    lMin: lRange.min,
    hl: new Set(highlight.map((h) => h.trim().toLowerCase())),
    showText,
  };
  const speed = waveSpeed(frequency, wavelength);
  const changed = amplitude !== start.amplitude || wavelength !== start.wavelength || frequency !== start.frequency;
  const title = longitudinal ? "Longitudinal wave" : "Transverse wave";
  const H = longitudinal ? 216 : 268;

  return (
    <DiagramFigure title={title}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full select-none"
        role="img"
        aria-label={`${title} travelling to the right: amplitude ${fmtNum(amplitude)} m, wavelength ${fmtNum(wavelength)} m, frequency ${fmtNum(frequency)} Hz.`}
      >
        {longitudinal ? <LongitudinalScene {...scene} /> : <TransverseScene {...scene} />}
      </svg>

      {start.controls && (
        <div className="mt-2 grid gap-3 rounded-lg bg-paper p-3 sm:grid-cols-3">
          <Slider label="Amplitude" name="amplitude" value={amplitude} unit="m" range={aRange} onChange={setAmplitude} />
          <Slider
            label={
              <>
                Wavelength <em>λ</em>
              </>
            }
            name="wavelength"
            value={wavelength}
            unit="m"
            range={lRange}
            onChange={setWavelength}
          />
          <Slider
            label={
              <>
                Frequency <em>f</em>
              </>
            }
            name="frequency"
            value={frequency}
            unit="Hz"
            range={fRange}
            onChange={setFrequency}
          />
        </div>
      )}
      {start.controls && showText && (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg bg-navy px-4 py-3 text-white">
          <span className="text-sm opacity-80">Wave speed</span>
          <span className="text-lg font-bold sm:text-xl" aria-live="polite">
            <em>v</em> = <em>f</em> × <em>λ</em> = {fmtNum(frequency)} Hz × {fmtNum(wavelength)} m {eqSign(speed)} {fmtNum(speed)} m/s
          </span>
          <span className="text-sm text-gold-300">The amplitude doesn&apos;t change the speed.</span>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <p className="max-w-prose text-xs text-muted">
          {longitudinal
            ? "Longitudinal wave (like sound): the particles vibrate back and forth, parallel to the direction the wave transfers energy. The blue line is one particle; the dashed line is its rest position."
            : "Transverse wave: the particles vibrate up and down, at right angles (perpendicular) to the direction the wave transfers energy. The blue dots are the same point on neighbouring waves."}
          {!reduced && timeScale < 1 && ` Shown ${fmtNum(1 / timeScale)}× slower than real life.`}
        </p>
        <div className="flex gap-3">
          {!reduced && <TextButton onClick={() => setPaused((p) => !p)}>{paused ? "Play" : "Pause"}</TextButton>}
          {changed && (
            <TextButton
              onClick={() => {
                setAmplitude(start.amplitude);
                setWavelength(start.wavelength);
                setFrequency(start.frequency);
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
