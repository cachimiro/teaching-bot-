import { electronConfig, findElement, massNumber, type ChemicalElement } from "../data/elements";

// Pure helpers shared by the atom entry (atom.tsx) and its drawing (components/diagrams/atom-diagram.tsx).
// No React here, so the server can use it.

/** Names of the common negative ions for elements 1–20 (GCSE uses -ide names for these). */
export const ANION_NAMES: Record<number, string> = { 1: "hydride", 7: "nitride", 8: "oxide", 9: "fluoride", 15: "phosphide", 16: "sulfide", 17: "chloride" };

const SUPERSCRIPT: Record<string, string> = { "1": "¹", "2": "²", "3": "³", "+": "⁺", "-": "⁻" };

/** "Na" + 1 → "Na⁺", "O" − 2 → "O²⁻". */
export function ionFormula(symbol: string, charge: number): string {
  if (charge === 0) return symbol;
  const size = Math.abs(charge) === 1 ? "" : String(Math.abs(charge));
  return symbol + [...size, charge > 0 ? "+" : "-"].map((c) => SUPERSCRIPT[c]).join("");
}

/** The charge as written after brackets: "+", "2+", "−", "3−". */
export function chargeLabel(charge: number): string {
  const size = Math.abs(charge) === 1 ? "" : String(Math.abs(charge));
  return `${size}${charge > 0 ? "+" : "−"}`;
}

/** The charge in words-and-numbers for the caption: "1+", "2−". */
export const chargeText = (charge: number) => `${Math.abs(charge)}${charge > 0 ? "+" : "−"}`;

/** Accepts 1, -2, "+1", "2+", "2-", "−", "+". undefined → 0; null → not a usable charge. */
export function parseCharge(value: unknown): number | null {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  if (typeof value !== "string") return null;
  const m = value.trim().replace(/[−–]/g, "-").match(/^([+-])?(\d+)?([+-])?$/);
  if (!m || (m[1] && m[3]) || (!m[1] && !m[2] && !m[3])) return null;
  const size = m[2] === undefined ? 1 : Number(m[2]);
  return (m[1] ?? m[3]) === "-" ? -size : size;
}

export type AtomModel = {
  el: ChemicalElement;
  charge: number;
  electrons: number;
  neutrons: number;
  shells: number[];
  /** For negative ions: how many of the outer electrons were gained (drawn as crosses). */
  gained: number;
};

/** Works out the atom or ion a spec asks for, or explains why it can't be drawn. */
export function resolveAtom(spec: Record<string, unknown>): AtomModel | { error: string } {
  const raw = spec.element;
  if (raw === undefined || raw === null || raw === "") return { error: '"atom" needs an "element", e.g. {"name": "atom", "element": "Na"}' };
  if (typeof raw !== "string" && typeof raw !== "number") return { error: '"element" should be a symbol, name or atomic number' };
  const el = findElement(raw);
  if (!el) return { error: `No element called "${raw}"` };
  if (el.z > 20) return { error: `"atom" draws elements 1–20 only (${el.name} is element ${el.z})` };
  const charge = parseCharge(spec.charge);
  if (charge === null) return { error: '"charge" should be a whole number from −3 to +3, e.g. 1 or -2' };
  if (Math.abs(charge) > 3) return { error: `A charge of ${charge} is too big: use −3 to +3` };
  const electrons = el.z - charge;
  if (electrons < 0) return { error: `${el.name} has only ${el.z} electron${el.z === 1 ? "" : "s"} to lose` };
  const shells = electronConfig(electrons);
  if (!shells) return { error: `${electrons} electrons is beyond the GCSE shell model (2,8,8,2)` };
  return { el, charge, electrons, neutrons: massNumber(el.z) - el.z, shells, gained: Math.max(0, -charge) };
}

const HIGHLIGHTS: Record<string, "outer" | "nucleus" | "electrons" | "shells"> = {
  "outer shell": "outer",
  "outer electrons": "outer",
  "outermost shell": "outer",
  "outer shell electrons": "outer",
  "valence shell": "outer",
  "valence electrons": "outer",
  nucleus: "nucleus",
  protons: "nucleus",
  neutrons: "nucleus",
  electrons: "electrons",
  electron: "electrons",
  shells: "shells",
  shell: "shells",
  "electron shells": "shells",
  "energy levels": "shells",
};

export const highlightKey = (h: string) => HIGHLIGHTS[h.trim().toLowerCase().replace(/\s+/g, " ")];
