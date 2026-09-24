"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { fmtNum, type SliderRange } from "@/lib/diagrams/library/physics";

/** Shared look and behaviour for the physics diagrams (wave, circuit, forces, em-spectrum). */

export const NAVY = "#0b1e3c";
export const GOLD = "#c19a3e";
export const GOLD_TEXT = "#7d6325";
export const BLUE = "#3f63a0";
export const MUTED = "#5b6675";
export const GUIDE = "#a7bbd9";
export const FONT = "var(--font-inter), system-ui, sans-serif";
export const GLOW = `drop-shadow(0 0 5px ${GOLD}) drop-shadow(0 0 2px ${GOLD})`;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True when the student has asked their device for less motion (animations then show a still frame). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/**
 * Integrates each rate over time on requestAnimationFrame (value += rate × dt). Integrating, rather
 * than multiplying by elapsed time, keeps the picture smooth when a slider changes a rate. The loop
 * only runs while `running` and while `target` is on screen, and stops on unmount.
 */
export function useIntegrals(rates: readonly number[], running: boolean, target: RefObject<Element | null>): number[] {
  const ratesRef = useRef(rates);
  useEffect(() => {
    ratesRef.current = rates;
  });
  const [values, setValues] = useState<number[]>([]);

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      if (dt > 0) setValues((prev) => ratesRef.current.map((r, i) => (prev[i] ?? 0) + r * dt));
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      if (frame) return;
      last = 0;
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const el = target.current;
    let observer: IntersectionObserver | undefined;
    if (el && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver((entries) => (entries[entries.length - 1]?.isIntersecting ? start() : stop()));
      observer.observe(el);
    } else {
      start();
    }
    return () => {
      stop();
      observer?.disconnect();
    };
  }, [running, target]);

  return values;
}

/** The card every diagram sits in, with its title. */
export function DiagramFigure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <figure className="my-3 rounded-xl border border-navy-100 bg-white p-3">
      <figcaption className="mb-1 text-sm font-semibold text-navy">{title}</figcaption>
      {children}
    </figure>
  );
}

/** A labelled slider with its live value, in the style of the "What happens if…" explorer. */
export function Slider({
  label,
  name,
  value,
  unit,
  range,
  onChange,
}: {
  label: ReactNode;
  /** Plain-text name for screen readers ("amplitude"). */
  name: string;
  value: number;
  unit: string;
  range: SliderRange;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-sm text-navy">
      <span className="flex justify-between gap-2">
        <span>{label}</span>
        <span className="font-semibold tabular-nums">
          {fmtNum(value)} {unit}
        </span>
      </span>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-navy"
        aria-label={`Change ${name}`}
      />
    </label>
  );
}

/** Small text button (Pause, Play, Reset). */
export function TextButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="text-xs font-semibold text-navy-400 hover:text-navy">
      {children}
    </button>
  );
}

/**
 * A straight arrow from (x1, y1) to (x2, y2) with a filled head at the end (and at the start too when
 * `double`). Draws nothing for a zero-length arrow.
 */
export function Arrow({
  x1,
  y1,
  x2,
  y2,
  colour = NAVY,
  width = 2.5,
  head = 10,
  double = false,
  dash,
  opacity,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  colour?: string;
  width?: number;
  head?: number;
  double?: boolean;
  dash?: string;
  opacity?: number;
}) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 0.5) return null;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const h = Math.min(head, len * (double ? 0.45 : 0.7));
  const half = h * 0.42;
  const headAt = (tx: number, ty: number, dx: number, dy: number) => {
    const bx = tx - dx * h;
    const by = ty - dy * h;
    return `${tx},${ty} ${bx - dy * half},${by + dx * half} ${bx + dy * half},${by - dx * half}`;
  };
  const sx = double ? x1 + ux * (h - 1) : x1;
  const sy = double ? y1 + uy * (h - 1) : y1;
  return (
    <g opacity={opacity}>
      <line x1={sx} y1={sy} x2={x2 - ux * (h - 1)} y2={y2 - uy * (h - 1)} stroke={colour} strokeWidth={width} strokeDasharray={dash} />
      <polygon points={headAt(x2, y2, ux, uy)} fill={colour} />
      {double && <polygon points={headAt(x1, y1, -ux, -uy)} fill={colour} />}
    </g>
  );
}

/** SVG text with a white halo so it stays readable when it crosses a line. */
export function Label({
  x,
  y,
  children,
  anchor = "middle",
  size = 13,
  weight = 500,
  colour = NAVY,
  opacity,
  halo = true,
}: {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: "start" | "middle" | "end";
  size?: number;
  weight?: number;
  colour?: string;
  opacity?: number;
  /** White outline behind the letters (on by default); turn off on coloured backgrounds. */
  halo?: boolean;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={size}
      fontWeight={weight}
      fill={colour}
      fontFamily={FONT}
      paintOrder="stroke"
      stroke={halo ? "#fff" : "none"}
      strokeWidth={halo ? 4 : 0}
      strokeLinejoin="round"
      opacity={opacity}
      pointerEvents="none"
    >
      {children}
    </text>
  );
}
