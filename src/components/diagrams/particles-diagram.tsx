"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { CustomDiagramProps } from "@/lib/diagrams/types";
import { BOIL, BOX_H, BOX_W, MELT, RADIUS, createSim, normaliseState, phaseAt, stepSim, type Phase, type Sim } from "@/lib/diagrams/library/particles-model";

const NAVY = "#0b1e3c";
const FONT = "var(--font-inter), system-ui, sans-serif";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

const STATE_NAME: Record<Phase, string> = { solid: "Solid", liquid: "Liquid", gas: "Gas" };

const DESCRIPTION: Record<Phase, string> = {
  solid: "Solid: particles are in a regular pattern and touching. They vibrate about fixed positions and have the least energy.",
  liquid: "Liquid: particles are touching but randomly arranged. They move around, sliding past each other, and have more energy than in a solid.",
  gas: "Gas: particles are far apart and randomly arranged. They move quickly in all directions, in straight lines until they collide, and have the most energy.",
};

const SHORT: Record<Phase, string> = {
  solid: "Regular pattern, touching. Vibrate in fixed positions.",
  liquid: "Random, touching. Slide past each other.",
  gas: "Far apart, random. Move quickly in all directions.",
};

const START_TEMP: Record<Phase, number> = { solid: 15, liquid: 52, gas: 85 };

/** One container. The animation loop moves the circles directly, so React doesn't re-render per frame. */
function ParticleBox({
  x,
  y,
  phase,
  heat,
  seed,
  running,
  reduced,
  fill,
  label,
}: {
  x: number;
  y: number;
  phase: Phase;
  heat: number;
  seed: number;
  running: boolean;
  reduced: boolean;
  fill: string;
  label?: string;
}) {
  const groupRef = useRef<SVGGElement>(null);
  const simRef = useRef<Sim | null>(null);
  const live = useRef({ phase, heat });
  useEffect(() => {
    live.current = { phase, heat };
  }, [phase, heat]);

  // What React draws: the starting arrangement while animating (so re-renders never fight the loop),
  // or a still of the current state when motion is reduced.
  const [startPhase] = useState(phase);
  const start = useMemo(() => createSim(startPhase, seed).ps, [startPhase, seed]);
  const still = useMemo(() => (reduced ? createSim(phase, seed).ps : null), [reduced, phase, seed]);
  const shown = still ?? start;

  useEffect(() => {
    const group = groupRef.current;
    if (!running || !group) return;
    const circles = Array.from(group.querySelectorAll<SVGCircleElement>("circle[data-particle]"));
    const sim = (simRef.current ??= createSim(startPhase, seed));
    let raf = 0;
    let last = 0;
    let visible = true;

    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(2.5, (now - last) / (1000 / 60)) : 1;
      last = now;
      stepSim(sim, live.current.phase, live.current.heat, dt);
      sim.ps.forEach((p, i) => {
        circles[i]?.setAttribute("cx", p.x.toFixed(2));
        circles[i]?.setAttribute("cy", p.y.toFixed(2));
      });
      if (visible) raf = requestAnimationFrame(frame);
    };

    // Pause while scrolled out of view.
    const svg = group.ownerSVGElement ?? group;
    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (visible && !raf) {
              last = 0;
              raf = requestAnimationFrame(frame);
            }
          });
    io?.observe(svg);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [running, seed, startPhase]);

  const showArrows = reduced && phase === "gas";
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-1.5} y={-1.5} width={BOX_W + 3} height={BOX_H + 3} rx={6} fill="#f7f9fc" stroke={NAVY} strokeWidth={3} />
      <g ref={groupRef}>
        {shown.map((p, i) => (
          <circle key={i} data-particle cx={p.x} cy={p.y} r={RADIUS} fill={fill} stroke={NAVY} strokeWidth={1} />
        ))}
      </g>
      {showArrows &&
        shown.map((p, i) => {
          const s = Math.hypot(p.vx, p.vy) || 1;
          const ux = p.vx / s;
          const uy = p.vy / s;
          const x1 = p.x + ux * (RADIUS + 2);
          const y1 = p.y + uy * (RADIUS + 2);
          const x2 = p.x + ux * (RADIUS + 13);
          const y2 = p.y + uy * (RADIUS + 13);
          const head = `M${x2},${y2} L${x2 - ux * 5 - uy * 3.5},${y2 - uy * 5 + ux * 3.5} L${x2 - ux * 5 + uy * 3.5},${y2 - uy * 5 - ux * 3.5} Z`;
          return (
            <g key={`a${i}`} stroke="#3f63a0" fill="#3f63a0" strokeWidth={1.5}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} />
              <path d={head} stroke="none" />
            </g>
          );
        })}
      {label && (
        <text x={BOX_W / 2} y={BOX_H + 30} textAnchor="middle" fontSize={19} fontWeight={700} fill={NAVY} fontFamily={FONT}>
          {label}
        </text>
      )}
    </g>
  );
}

/** Thermometer beside the slider container, marking the melting and boiling points. */
function Thermometer({ x, temp }: { x: number; temp: number }) {
  const top = 22;
  const bottom = 186;
  const yAt = (t: number) => bottom - (t / 100) * (bottom - top);
  const marks: [number, string][] = [
    [BOIL, "boiling point"],
    [MELT, "melting point"],
  ];
  return (
    <g fontFamily={FONT}>
      <rect x={x - 7} y={top - 7} width={14} height={bottom - top + 14} rx={7} fill="#fff" stroke={NAVY} strokeWidth={2} />
      <rect x={x - 3.5} y={yAt(temp)} width={7} height={bottom - yAt(temp) + 8} fill="#d9534f" />
      <circle cx={x} cy={bottom + 18} r={13} fill="#d9534f" stroke={NAVY} strokeWidth={2} />
      {marks.map(([t, text]) => (
        <g key={text}>
          <line x1={x + 8} x2={x + 18} y1={yAt(t)} y2={yAt(t)} stroke={NAVY} strokeWidth={2} />
          <text x={x + 22} y={yAt(t) + 5} fontSize={14} fill={NAVY}>
            {text}
          </text>
        </g>
      ))}
    </g>
  );
}

/** Particle model of solids, liquids and gases: animated containers, optionally with a temperature slider. */
export function ParticlesDiagram({ spec }: CustomDiagramProps) {
  const reduced = usePrefersReducedMotion();
  const [paused, setPaused] = useState(false);
  const state = normaliseState(spec.state) ?? "all";
  const controls = spec.controls === true;
  const [temp, setTemp] = useState(START_TEMP[state === "all" ? "solid" : state]);
  const gradientId = `particle-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const fill = `url(#${gradientId})`;
  const running = !reduced && !paused;
  const current = phaseAt(temp);

  const gradient = (
    <defs>
      <radialGradient id={gradientId} cx="35%" cy="32%" r="70%">
        <stop offset="0%" stopColor="#dbe6f7" />
        <stop offset="55%" stopColor="#7d9bd0" />
        <stop offset="100%" stopColor="#3f63a0" />
      </radialGradient>
    </defs>
  );

  const pauseButton = !reduced && (
    <button type="button" onClick={() => setPaused((p) => !p)} className="text-xs font-semibold text-navy-400 hover:text-navy">
      {paused ? "Play" : "Pause"}
    </button>
  );

  let title: string;
  let body: ReactNode;
  if (controls) {
    title = "Heating a substance: solid → liquid → gas";
    body = (
      <>
        <svg viewBox="0 0 340 250" className="mx-auto h-auto w-full max-w-md select-none" role="img" aria-label={`Particle model: ${DESCRIPTION[current.phase]}`}>
          {gradient}
          <ParticleBox x={24} y={20} phase={current.phase} heat={current.heat} seed={7} running={running} reduced={reduced} fill={fill} label={STATE_NAME[current.phase]} />
          <Thermometer x={214} temp={temp} />
        </svg>
        <div className="mt-2 grid gap-2 rounded-lg bg-paper p-3">
          <label className="flex items-center gap-3 text-sm text-navy">
            <span className="font-semibold">Temperature</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={temp}
              onChange={(e) => setTemp(Number(e.target.value))}
              className="flex-1 accent-navy"
              aria-label="Temperature"
              aria-valuetext={`${STATE_NAME[current.phase]}${temp === MELT ? ", at the melting point" : temp === BOIL ? ", at the boiling point" : ""}`}
            />
          </label>
          <p className="text-sm font-medium text-navy" aria-live="polite">
            {DESCRIPTION[current.phase]}
          </p>
        </div>
      </>
    );
  } else if (state === "all") {
    title = "Particles in solids, liquids and gases";
    const phases: Phase[] = ["solid", "liquid", "gas"];
    body = (
      <>
        <svg viewBox="0 0 534 236" className="h-auto w-full select-none" role="img" aria-label={`Particle model. ${phases.map((p) => DESCRIPTION[p]).join(" ")}`}>
          {gradient}
          {phases.map((p, i) => (
            <ParticleBox key={p} x={12 + i * 180} y={12} phase={p} heat={0.5} seed={11 + i * 12} running={running} reduced={reduced} fill={fill} label={STATE_NAME[p]} />
          ))}
        </svg>
        <div className="mt-1 grid grid-cols-3 gap-2 text-center text-xs text-muted">
          {phases.map((p) => (
            <p key={p}>{SHORT[p]}</p>
          ))}
        </div>
      </>
    );
  } else {
    title = `Particles in a ${state}`;
    body = (
      <>
        <svg viewBox="0 0 174 240" className="mx-auto h-auto w-full max-w-[16rem] select-none" role="img" aria-label={`Particle model: ${DESCRIPTION[state]}`}>
          {gradient}
          <ParticleBox x={12} y={12} phase={state} heat={0.5} seed={11 + ["solid", "liquid", "gas"].indexOf(state) * 12} running={running} reduced={reduced} fill={fill} label={STATE_NAME[state]} />
        </svg>
        <p className="mt-1 text-center text-sm text-navy">{DESCRIPTION[state]}</p>
      </>
    );
  }

  return (
    <figure className="my-3 rounded-xl border border-navy-100 bg-white p-3">
      <figcaption className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold text-navy">{title}</span>
        {pauseButton}
      </figcaption>
      {body}
    </figure>
  );
}

