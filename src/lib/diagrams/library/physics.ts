/**
 * Pure maths, data and option parsing for the physics diagrams (wave, circuit, forces, em-spectrum).
 * No React in here, so it is unit-tested directly and safe to import on the server or the client.
 */

// ─── Numbers ────────────────────────────────────────────────────────────────

export const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Removes floating-point noise (0.30000000000000004 → 0.3). */
const tidy = (x: number) => Number(x.toPrecision(12));

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "-": "⁻",
};
export const superscript = (n: number) => [...String(n)].map((c) => SUPERSCRIPT[c] ?? c).join("");

/**
 * A number the way a student would write it: 3 significant figures (whole numbers are never cut short),
 * standard form for very large or very small values, and a proper minus sign.
 */
export function fmtNum(v: number, sf = 3): string {
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) < 1e-12) return "0";
  const sign = v < 0 ? "−" : "";
  const abs = Math.abs(v);
  let exp = Math.floor(Math.log10(abs));
  if (abs >= 1e6 || abs < 1e-3) {
    let mantissa = Number((abs / 10 ** exp).toPrecision(sf));
    if (mantissa >= 10) {
      mantissa /= 10;
      exp += 1;
    }
    return `${sign}${mantissa} × 10${superscript(exp)}`;
  }
  return sign + String(Number(abs.toPrecision(Math.min(15, Math.max(sf, exp + 1)))));
}

/** "=" when the shown value is exact, "≈" when it has been rounded. */
export const eqSign = (v: number) => (Math.abs(Number(fmtNum(v).replace("−", "-")) - v) < 1e-9 ? "=" : "≈");

export type SliderRange = { min: number; max: number; step: number };

function niceAtLeast(raw: number): number {
  const p = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 5, 10]) if (m * p >= raw * (1 - 1e-9)) return tidy(m * p);
  return tidy(10 * p);
}

function nextSmallerNice(s: number): number {
  const p = 10 ** Math.floor(Math.log10(s) + 1e-9);
  const m = Math.round(s / p);
  return tidy(m === 5 ? 2 * p : m === 2 ? p : p / 2);
}

const onGrid = (v: number, step: number) => Math.abs(v / step - Math.round(v / step)) < 1e-6;

/**
 * Slider bounds covering [lo, hi] (and the starting value), with a "nice" step (1, 2 or 5 × 10ⁿ)
 * chosen so the starting value sits exactly on the slider. lo ≤ 0 allows a minimum of 0; otherwise
 * the minimum stays positive.
 */
export function sliderRange(value: number, lo: number, hi: number, steps = 50): SliderRange {
  const low = Math.min(lo, value);
  const high = Math.max(hi, value);
  let step = niceAtLeast((high - low) / steps || Math.abs(value) / steps || 1);
  for (let i = 0, s = step; i < 8; i++, s = nextSmallerNice(s)) {
    if (onGrid(value, s)) {
      step = s;
      break;
    }
  }
  const floor = tidy(Math.floor(low / step + 1e-9) * step);
  return { min: low <= 0 ? floor : Math.max(step, floor), max: tidy(Math.ceil(high / step - 1e-9) * step), step };
}

// ─── Waves ──────────────────────────────────────────────────────────────────

export type WaveType = "transverse" | "longitudinal";
export type WaveOptions = { type: WaveType; amplitude: number; wavelength: number; frequency: number; controls: boolean };

/** Reads a (validated) wave spec, filling in defaults. */
export function readWaveOptions(spec: Record<string, unknown>): WaveOptions {
  const positive = (v: unknown, fallback: number) => (isNum(v) && v > 0 ? v : fallback);
  return {
    type: spec.type === "longitudinal" ? "longitudinal" : "transverse",
    amplitude: positive(spec.amplitude, 2),
    wavelength: positive(spec.wavelength, 4),
    frequency: positive(spec.frequency, 1),
    controls: spec.controls !== false,
  };
}

/** Wave speed v = f × λ (m/s from Hz and m). */
export const waveSpeed = (frequency: number, wavelength: number) => frequency * wavelength;

/**
 * Displacement at distance x of a wave travelling to the right. `cycles` is how many oscillations have
 * happened so far (∫ f dt), so changing the frequency mid-animation never makes the wave jump.
 * Transverse: displacement up (+) / down (−). Longitudinal: displacement right (+) / left (−).
 */
export function waveDisplacement(x: number, amplitude: number, wavelength: number, cycles: number): number {
  return amplitude * Math.sin(2 * Math.PI * (x / wavelength - cycles));
}

/**
 * Where each repeating feature sits, as a fraction of a wavelength along the wave at cycles = 0.
 * Crest where the sine peaks; for a longitudinal wave, particles either side move towards x = 0.5λ
 * (a compression) and away from x = 0 (a rarefaction).
 */
export const WAVE_FEATURES = { crest: 0.25, compression: 0.5, trough: 0.75, rarefaction: 0 } as const;
export type WaveFeature = keyof typeof WAVE_FEATURES;

/** Positions (0 ≤ x ≤ width) of every crest, trough, compression or rarefaction at this moment. */
export function featurePositions(feature: WaveFeature, width: number, wavelength: number, cycles: number): number[] {
  const phase = (((cycles + WAVE_FEATURES[feature]) % 1) + 1) % 1;
  const out: number[] = [];
  for (let x = wavelength * phase; x <= width + 1e-9; x += wavelength) out.push(tidy(x));
  return out;
}

/**
 * A label that rides along with a moving feature: picks the copy of the feature nearest `target`
 * (both in wavelengths along the wave) and fades it out as it drifts more than 0.3λ away, so the label
 * hands over smoothly to the next crest instead of jumping.
 */
export function ridingLabel(target: number, feature: WaveFeature, cycles: number): { at: number; opacity: number } {
  const offset = WAVE_FEATURES[feature];
  const at = cycles + offset + Math.round(target - cycles - offset);
  const d = Math.abs(at - target);
  return { at, opacity: d <= 0.3 ? 1 : Math.max(0, (0.5 - d) / 0.2) };
}

// ─── Circuits ───────────────────────────────────────────────────────────────

export type CircuitType = "series" | "parallel";
export type CircuitOptions = { type: CircuitType; voltage: number; resistors: number[]; controls: boolean };
export type CircuitResult = {
  /** Ω */
  totalResistance: number;
  /** A, through the cell and ammeter */
  current: number;
  /** Per resistor: its resistance (Ω), current through it (A) and potential difference across it (V). */
  resistors: { resistance: number; current: number; pd: number }[];
};

export function readCircuitOptions(spec: Record<string, unknown>): CircuitOptions {
  const resistors = Array.isArray(spec.resistors) && spec.resistors.length > 0 ? spec.resistors.filter(isNum).slice(0, 3) : [2, 4];
  return {
    type: spec.type === "parallel" ? "parallel" : "series",
    voltage: isNum(spec.voltage) && spec.voltage >= 0 ? spec.voltage : 6,
    resistors: resistors.length ? resistors : [2, 4],
    controls: spec.controls !== false,
  };
}

/**
 * Series: R = R1 + R2 + …, one current I = V / R everywhere, and the p.d. shared in proportion to
 * resistance (Vn = I × Rn). Parallel: 1/R = 1/R1 + 1/R2 + …, every branch gets the full p.d., branch
 * currents In = V / Rn add up to the total current.
 */
export function circuitValues(type: CircuitType, voltage: number, resistors: number[]): CircuitResult {
  if (type === "series") {
    const total = resistors.reduce((s, r) => s + r, 0);
    const current = voltage / total;
    return { totalResistance: total, current, resistors: resistors.map((r) => ({ resistance: r, current, pd: current * r })) };
  }
  const branches = resistors.map((r) => ({ resistance: r, current: voltage / r, pd: voltage }));
  return {
    totalResistance: 1 / resistors.reduce((s, r) => s + 1 / r, 0),
    current: branches.reduce((s, b) => s + b.current, 0),
    resistors: branches,
  };
}

/** Points spaced `gap` apart along a polyline, shifted by `offset` (for moving charge dots). */
export function pointsAlong(path: [number, number][], offset: number, gap: number): [number, number][] {
  const out: [number, number][] = [];
  let start = ((offset % gap) + gap) % gap;
  for (let i = 1; i < path.length; i++) {
    const [x0, y0] = path[i - 1];
    const [x1, y1] = path[i];
    const len = Math.hypot(x1 - x0, y1 - y0);
    let d = start;
    for (; d < len; d += gap) out.push([x0 + ((x1 - x0) * d) / len, y0 + ((y1 - y0) * d) / len]);
    start = d - len;
  }
  return out;
}

// ─── Forces ─────────────────────────────────────────────────────────────────

export const DIRECTIONS = ["left", "right", "up", "down"] as const;
export type Direction = (typeof DIRECTIONS)[number];
export type Force = { label: string; size: number; direction: Direction };

export const FORCE_OBJECTS = ["car", "box", "skydiver", "rocket", "ball"] as const;
export type ForceObject = (typeof FORCE_OBJECTS)[number];

export type Resultant = {
  /** Net force to the right (N); negative means to the left. */
  x: number;
  /** Net force upwards (N); negative means downwards. */
  y: number;
  /** Size of the resultant (N), by Pythagoras when forces act on both axes. */
  size: number;
  balanced: boolean;
  /** "to the right", "upwards", "up and to the left"…, or "" when balanced. */
  direction: string;
  /** Angle from the horizontal in degrees (0 horizontal, 90 vertical). */
  angle: number;
};

export const parseDirection = (v: unknown): Direction | null => {
  const d = typeof v === "string" ? v.trim().toLowerCase() : "";
  return (DIRECTIONS as readonly string[]).includes(d) ? (d as Direction) : null;
};

/** Adds the forces along each axis, then combines the two axes by Pythagoras. */
export function resultantForce(forces: Force[]): Resultant {
  let x = 0;
  let y = 0;
  for (const f of forces) {
    if (f.direction === "right") x += f.size;
    else if (f.direction === "left") x -= f.size;
    else if (f.direction === "up") y += f.size;
    else y -= f.size;
  }
  x = Math.abs(x) < 1e-9 ? 0 : tidy(x);
  y = Math.abs(y) < 1e-9 ? 0 : tidy(y);
  const size = Math.hypot(x, y);
  const horizontal = x > 0 ? "right" : "left";
  const vertical = y > 0 ? "up" : "down";
  const direction =
    size === 0 ? "" : y === 0 ? `to the ${horizontal}` : x === 0 ? `${vertical}wards` : `${vertical} and to the ${horizontal}`;
  return { x, y, size, balanced: size === 0, direction, angle: size === 0 ? 0 : (Math.atan2(Math.abs(y), Math.abs(x)) * 180) / Math.PI };
}

/** Newton's second law: a = F / m (m/s² from N and kg). */
export const acceleration = (force: number, mass: number) => force / mass;

const DEFAULT_FORCES: Record<ForceObject, Force[]> = {
  car: [
    { label: "Driving force", size: 500, direction: "right" },
    { label: "Drag", size: 300, direction: "left" },
  ],
  box: [
    { label: "Push", size: 200, direction: "right" },
    { label: "Friction", size: 200, direction: "left" },
  ],
  skydiver: [
    { label: "Weight", size: 700, direction: "down" },
    { label: "Air resistance", size: 700, direction: "up" },
  ],
  rocket: [
    { label: "Thrust", size: 30000, direction: "up" },
    { label: "Weight", size: 20000, direction: "down" },
  ],
  ball: [
    { label: "Weight", size: 5, direction: "down" },
    { label: "Air resistance", size: 1, direction: "up" },
  ],
};

export type ForcesOptions = { object: ForceObject; forces: Force[]; mass: number | null; controls: boolean };

export function readForcesOptions(spec: Record<string, unknown>): ForcesOptions {
  const object = (FORCE_OBJECTS as readonly string[]).includes(String(spec.object)) ? (spec.object as ForceObject) : "box";
  const forces = Array.isArray(spec.forces)
    ? spec.forces.flatMap((f): Force[] => {
        const o = (f ?? {}) as Record<string, unknown>;
        const direction = parseDirection(o.direction);
        return direction && isNum(o.size) && o.size >= 0 ? [{ label: typeof o.label === "string" && o.label.trim() ? o.label.trim() : "Force", size: o.size, direction }] : [];
      })
    : [];
  return {
    object,
    forces: forces.length ? forces.slice(0, 6) : DEFAULT_FORCES[object],
    mass: isNum(spec.mass) && spec.mass > 0 ? spec.mass : null,
    controls: spec.controls !== false,
  };
}

// ─── Electromagnetic spectrum ───────────────────────────────────────────────

export type EmBand = {
  id: string;
  name: string;
  /** The name split over two lines for the band label. */
  lines: [string, string?];
  aliases: string[];
  /** Order of magnitude shown on the band. */
  typical: string;
  /** Wavelength range in words. */
  range: string;
  uses: string[];
  dangers: string;
  ionising: boolean;
  fill: string;
};

/** The seven GCSE bands, longest wavelength (lowest frequency and energy) first. */
export const EM_BANDS: EmBand[] = [
  {
    id: "radio",
    name: "Radio waves",
    lines: ["Radio", "waves"],
    aliases: ["radio", "radiowave", "radiowaves"],
    typical: "10³ m",
    range: "longest: from about 30 cm to many kilometres",
    uses: ["Radio and television broadcasting", "Communications (e.g. two-way radios)"],
    dangers: "Lowest energy. Not ionising and not considered harmful at normal levels.",
    ionising: false,
    fill: "#dde7f3",
  },
  {
    id: "microwaves",
    name: "Microwaves",
    lines: ["Micro-", "waves"],
    aliases: ["microwave", "microwaves"],
    typical: "10⁻² m",
    range: "about 1 mm to 30 cm (a few centimetres is typical)",
    uses: ["Cooking food (microwave ovens)", "Satellite communications", "Mobile phone and Wi-Fi signals"],
    dangers: "Can heat water inside the body, causing internal heating of body cells.",
    ionising: false,
    fill: "#d8efe6",
  },
  {
    id: "infrared",
    name: "Infrared",
    lines: ["Infrared"],
    aliases: ["infrared", "ir", "infraredradiation", "infraredwaves", "infraredlight"],
    typical: "10⁻⁵ m",
    range: "about 700 nm to 1 mm",
    uses: ["Electric heaters, grills and toasters", "Infrared (thermal imaging) cameras", "TV remote controls"],
    dangers: "Transfers energy as heat: too much causes skin burns.",
    ionising: false,
    fill: "#fbdcd3",
  },
  {
    id: "visible",
    name: "Visible light",
    lines: ["Visible", "light"],
    aliases: ["visible", "visiblelight", "light"],
    typical: "5 × 10⁻⁷ m",
    range: "about 400 nm (violet) to 700 nm (red): the only part our eyes detect",
    uses: ["Seeing and illumination", "Photography", "Fibre optic communications"],
    dangers: "Very bright light (e.g. lasers or looking at the Sun) can damage the retina.",
    ionising: false,
    fill: "#ffffff",
  },
  {
    id: "ultraviolet",
    name: "Ultraviolet",
    lines: ["Ultra-", "violet"],
    aliases: ["ultraviolet", "uv", "ultravioletlight", "ultravioletradiation", "ultravioletwaves"],
    typical: "10⁻⁸ m",
    range: "about 10 nm to 400 nm",
    uses: ["Sun tanning and sunbeds", "Energy-efficient (fluorescent) lamps", "Security marking and spotting forged bank notes", "Disinfecting water"],
    dangers:
      "Damages skin cells and eyes: sunburn, premature skin ageing, a higher risk of skin cancer, and eye damage such as cataracts. The highest-frequency UV is ionising.",
    ionising: false,
    fill: "#e7dcf5",
  },
  {
    id: "x-rays",
    name: "X-rays",
    lines: ["X-rays"],
    aliases: ["xray", "xrays", "xradiation"],
    typical: "10⁻¹⁰ m",
    range: "about 0.01 nm to 10 nm (around the size of an atom)",
    uses: ["Medical imaging: seeing broken bones", "Airport security scanners", "Treating some cancers"],
    dangers: "Ionising: can damage cells and cause mutations in genes, which can lead to cancer.",
    ionising: true,
    fill: "#e2e6ee",
  },
  {
    id: "gamma",
    name: "Gamma rays",
    lines: ["Gamma", "rays"],
    aliases: ["gamma", "gammaray", "gammarays", "gammaradiation"],
    typical: "10⁻¹² m",
    range: "shortest: less than about 0.01 nm",
    uses: ["Killing cancer cells (radiotherapy)", "Sterilising medical equipment and food", "Medical tracers and imaging"],
    dangers: "Highest energy and ionising: can kill or damage cells and cause gene mutations and cancer.",
    ionising: true,
    fill: "#f3dbe8",
  },
];

const bandKey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/** Finds a band by id, name or common alias ("UV", "X-ray", "gamma rays", "visible light"…). */
export function findBand(name: string): EmBand | undefined {
  const key = bandKey(name);
  return EM_BANDS.find((b) => bandKey(b.id) === key || bandKey(b.name) === key || b.aliases.includes(key));
}
