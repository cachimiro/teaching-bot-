// The particle simulation and state names shared by the particles entry (particles.tsx) and its drawing
// (components/diagrams/particles-diagram.tsx). Pure: no React here.

export type Phase = "solid" | "liquid" | "gas";

// ---------- the particle simulation (pure, no React) ----------

/** Inside size of each container and the particles in it (viewBox units). */
export const BOX_W = 150;
export const BOX_H = 180;
export const RADIUS = 6.3;
export const COUNT = 36;
const LATTICE = 6;
const SPACING = 2 * RADIUS + 1.4;
/** Largest solid vibration, so the bottom row never pokes through the floor. */
const MAX_AMP = 2;

/** Temperature scale 0–100 for the slider: solid below MELT, liquid below BOIL, gas above. */
export const MELT = 35;
export const BOIL = 70;

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Lattice home (used in the solid). */
  hx: number;
  hy: number;
  /** Vibration frequencies (Hz) and phases, so neighbours don't move in step. */
  fx: number;
  fy: number;
  px: number;
  py: number;
  /** Where the particle was when the solid started forming (it glides from here to its home). */
  sx: number;
  sy: number;
};

export type Sim = {
  ps: Particle[];
  phase: Phase;
  /** Seconds of simulated time. */
  t: number;
  /** 0 → 1 while particles glide into the lattice after freezing. */
  settle: number;
  rng: () => number;
};

/** Small seeded PRNG (mulberry32): the same seed always gives the same starting picture. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Regular 6 × 6 lattice sitting on the bottom of the container, bottom row first. */
function latticeHomes(): [number, number][] {
  const x0 = (BOX_W - (LATTICE - 1) * SPACING) / 2;
  const homes: [number, number][] = [];
  for (let row = 0; row < LATTICE; row++) {
    for (let col = 0; col < LATTICE; col++) homes.push([x0 + col * SPACING, BOX_H - RADIUS - MAX_AMP - row * SPACING]);
  }
  return homes;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Pushes overlapping particles apart and bounces them (restitution 1 = perfectly elastic). */
function collide(ps: Particle[], restitution: number) {
  const minD = 2 * RADIUS;
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i];
    for (let j = i + 1; j < ps.length; j++) {
      const b = ps[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d2 = dx * dx + dy * dy;
      if (d2 >= minD * minD) continue;
      if (d2 < 1e-6) {
        dx = 0.01 * (j - i);
        dy = 0.01;
        d2 = dx * dx + dy * dy;
      }
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const push = (minD - d) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const closing = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (closing < 0) {
        const impulse = (-(1 + restitution) * closing) / 2;
        a.vx -= impulse * nx;
        a.vy -= impulse * ny;
        b.vx += impulse * nx;
        b.vy += impulse * ny;
      }
    }
  }
}

/** Keeps particles inside the container, bouncing off the walls. */
function walls(ps: Particle[], restitution: number) {
  for (const p of ps) {
    if (p.x < RADIUS) {
      p.x = RADIUS;
      if (p.vx < 0) p.vx = -p.vx * restitution;
    } else if (p.x > BOX_W - RADIUS) {
      p.x = BOX_W - RADIUS;
      if (p.vx > 0) p.vx = -p.vx * restitution;
    }
    if (p.y < RADIUS) {
      p.y = RADIUS;
      if (p.vy < 0) p.vy = -p.vy * restitution;
    } else if (p.y > BOX_H - RADIUS) {
      p.y = BOX_H - RADIUS;
      if (p.vy > 0) p.vy = -p.vy * restitution;
    }
  }
}

/** Liquid jostling: random kick size (plus more when hotter) and the damping per frame. */
const KICK = 0.55;
const KICK_HEAT = 0.45;
const DAMP = 0.9;

/** Gas speed in viewBox units per frame (at 60 fps): faster when hotter. */
const gasSpeed = (heat: number) => 1.6 + 2.2 * heat;

/** Called when the state changes: sets particles up for the new kind of motion. */
function enterPhase(sim: Sim, phase: Phase) {
  const { ps, rng } = sim;
  if (phase === "solid") {
    // Freeze roughly where they are: bottom particles take the bottom row of the lattice, and so on.
    const homes = latticeHomes();
    const byHeight = [...ps].sort((a, b) => b.y - a.y);
    for (let row = 0; row < LATTICE; row++) {
      const rowParticles = byHeight.slice(row * LATTICE, (row + 1) * LATTICE).sort((a, b) => a.x - b.x);
      rowParticles.forEach((p, col) => {
        [p.hx, p.hy] = homes[row * LATTICE + col];
      });
    }
    for (const p of ps) {
      p.sx = p.x;
      p.sy = p.y;
      p.vx = 0;
      p.vy = 0;
    }
    sim.settle = 0;
  } else if (phase === "gas") {
    for (const p of ps) {
      if (Math.hypot(p.vx, p.vy) < 0.6) {
        const angle = rng() * Math.PI * 2;
        p.vx = 0.6 * Math.cos(angle);
        p.vy = 0.6 * Math.sin(angle);
      }
    }
  }
  sim.phase = phase;
}

/**
 * Advances the simulation by `dt` frames (1 = one 60 fps frame). `heat` (0–1) is how far through
 * its state the substance is: hotter particles vibrate or move faster.
 */
export function stepSim(sim: Sim, phase: Phase, heat: number, dt: number) {
  if (phase !== sim.phase) enterPhase(sim, phase);
  sim.t += dt / 60;
  const { ps, rng } = sim;

  if (phase === "solid") {
    // Vibrate about fixed positions in a regular lattice (after gliding into place when freezing).
    sim.settle = Math.min(1, sim.settle + dt / 36);
    const ease = 1 - Math.pow(1 - sim.settle, 3);
    const amp = 0.8 + (MAX_AMP - 0.8) * heat;
    for (const p of ps) {
      const tx = p.hx + amp * Math.sin(2 * Math.PI * p.fx * sim.t + p.px);
      const ty = p.hy + amp * Math.sin(2 * Math.PI * p.fy * sim.t + p.py);
      p.x = p.sx + (tx - p.sx) * ease;
      p.y = p.sy + (ty - p.sy) * ease;
    }
    return;
  }

  if (phase === "liquid") {
    // Touching but jostling: gravity keeps them together at the bottom, random kicks make them
    // slide past each other, and damping stops them flying off.
    const kick = (KICK + KICK_HEAT * heat) * Math.sqrt(dt);
    const damp = Math.pow(DAMP, dt);
    for (const p of ps) {
      p.vx = (p.vx + (rng() - 0.5) * 2 * kick) * damp;
      p.vy = (p.vy + (rng() - 0.5) * 2 * kick + 0.18 * dt) * damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let k = 0; k < 2 + Math.ceil(dt); k++) {
      collide(ps, 0.2);
      walls(ps, 0.3);
    }
    return;
  }

  // Gas: straight lines at speed, elastic bounces off each other and the walls.
  for (const p of ps) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  collide(ps, 1);
  walls(ps, 1);
  // Gentle thermostat: nudge the average speed towards the temperature's speed.
  const rms = Math.sqrt(ps.reduce((s, p) => s + p.vx * p.vx + p.vy * p.vy, 0) / ps.length) || 1;
  const f = Math.pow(clamp(gasSpeed(heat) / rms, 0.96, 1.05), dt);
  for (const p of ps) {
    p.vx *= f;
    p.vy *= f;
  }
}

/** A container of particles in the given state, from a seeded, repeatable starting arrangement. */
export function createSim(phase: Phase, seed: number): Sim {
  const rng = seededRandom(seed);
  const homes = latticeHomes();
  const ps: Particle[] = homes.map(([hx, hy]) => ({
    x: hx,
    y: hy,
    vx: 0,
    vy: 0,
    hx,
    hy,
    fx: 3 + rng() * 2,
    fy: 3 + rng() * 2,
    px: rng() * Math.PI * 2,
    py: rng() * Math.PI * 2,
    sx: hx,
    sy: hy,
  }));
  const sim: Sim = { ps, phase: "solid", t: 0, settle: 1, rng };

  if (phase === "liquid") {
    // Loosely stacked rows along the bottom, then let them settle into a jumbled, touching pile.
    const perRow = Math.floor(BOX_W / (2 * RADIUS + 1));
    ps.forEach((p, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      p.x = RADIUS + 1 + col * (2 * RADIUS + 1) + (row % 2) * RADIUS + (rng() - 0.5) * 2;
      p.y = BOX_H - RADIUS - row * (2 * RADIUS + 2) - rng() * 2;
    });
    sim.phase = "liquid";
    for (let i = 0; i < 240; i++) stepSim(sim, "liquid", 0.5, 1);
    sim.t = 0;
  } else if (phase === "gas") {
    // Spread out across the whole container, each heading off in a random direction.
    const speed = gasSpeed(0.5);
    const placed: Particle[] = [];
    for (const p of ps) {
      for (let attempt = 0; attempt < 400; attempt++) {
        const x = RADIUS + rng() * (BOX_W - 2 * RADIUS);
        const y = RADIUS + rng() * (BOX_H - 2 * RADIUS);
        const minGap = attempt < 300 ? 4 * RADIUS : 2.2 * RADIUS;
        if (placed.every((q) => Math.hypot(q.x - x, q.y - y) >= minGap)) {
          p.x = x;
          p.y = y;
          break;
        }
      }
      const angle = rng() * Math.PI * 2;
      p.vx = speed * Math.cos(angle);
      p.vy = speed * Math.sin(angle);
      placed.push(p);
    }
    sim.phase = "gas";
  }
  return sim;
}

/** Which state the substance is in at a slider temperature (0–100), and how far through it. */
export function phaseAt(temp: number): { phase: Phase; heat: number } {
  if (temp < MELT) return { phase: "solid", heat: temp / MELT };
  if (temp < BOIL) return { phase: "liquid", heat: (temp - MELT) / (BOIL - MELT) };
  return { phase: "gas", heat: (temp - BOIL) / (100 - BOIL) };
}

/** The spec's "state" (any case, plurals accepted): "solid" | "liquid" | "gas" | "all", or null if unusable. */
export function normaliseState(value: unknown): Phase | "all" | null {
  if (value === undefined) return "all";
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  const map: Record<string, Phase | "all"> = {
    solid: "solid",
    solids: "solid",
    liquid: "liquid",
    liquids: "liquid",
    gas: "gas",
    gases: "gas",
    all: "all",
  };
  return map[v] ?? null;
}
