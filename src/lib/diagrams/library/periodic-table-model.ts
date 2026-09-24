import { findElement, isFBlockRow, tableColumn, type ChemicalElement, type ElementCategory } from "../data/elements";

// Layout, colours, highlight matching and info-panel text shared by the periodic table entry
// (periodic-table.tsx) and its drawing (components/diagrams/periodic-table-diagram.tsx). No React here.

// Geometry (viewBox units). Symbols are drawn large so they stay readable when the table is scaled
// down to phone width; the full details live in the HTML panel under the table.
export const CW = 46;
export const CH = 50;
export const GAP = 3;
export const LEFT = 24;
export const TOP = 28;
const F_GAP = 18;
export const colX = (col: number) => LEFT + (col - 1) * (CW + GAP);
export const rowY = (row: number) => TOP + (row - 1) * (CH + GAP);
export const F_TOP = rowY(8) + F_GAP - GAP;
export const TABLE_W = colX(18) + CW + 6;
export const TABLE_H = F_TOP + 2 * (CH + GAP) + 4;

export const CATEGORY_STYLE: Record<ElementCategory, { fill: string; label: string }> = {
  "alkali metal": { fill: "#fbd3cb", label: "Alkali metals" },
  "alkaline earth metal": { fill: "#fde4c2", label: "Alkaline earth metals" },
  "transition metal": { fill: "#dce6f5", label: "Transition metals" },
  "post-transition metal": { fill: "#d9ead7", label: "Other metals" },
  metalloid: { fill: "#ece5c8", label: "Metalloids" },
  "non-metal": { fill: "#cdeee4", label: "Non-metals" },
  halogen: { fill: "#cfe8f6", label: "Halogens" },
  "noble gas": { fill: "#e6ddf6", label: "Noble gases" },
  lanthanide: { fill: "#f6dcea", label: "Lanthanides" },
  actinide: { fill: "#f0d8de", label: "Actinides" },
};

/** Where an element's cell goes: main table (period row, column) or the two rows underneath. */
export function cellPosition(el: ChemicalElement): { x: number; y: number } {
  if (isFBlockRow(el.z)) {
    const first = el.z <= 71 ? 58 : 90;
    return { x: colX(4 + el.z - first), y: F_TOP + (el.z <= 71 ? 0 : CH + GAP) };
  }
  return { x: colX(tableColumn(el.z)!), y: rowY(el.period) };
}

// ---------- highlight matching ----------

export type Matcher = (el: ChemicalElement) => boolean;

const CATEGORY_WORDS: Record<string, Matcher> = {
  "alkali metal": (e) => e.category === "alkali metal",
  "alkaline earth metal": (e) => e.category === "alkaline earth metal",
  "transition metal": (e) => e.category === "transition metal",
  "transition element": (e) => e.category === "transition metal",
  "post-transition metal": (e) => e.category === "post-transition metal",
  "other metal": (e) => e.category === "post-transition metal",
  metalloid: (e) => e.category === "metalloid",
  "semi-metal": (e) => e.category === "metalloid",
  semimetal: (e) => e.category === "metalloid",
  halogen: (e) => e.category === "halogen",
  "noble gas": (e) => e.category === "noble gas",
  "inert gas": (e) => e.category === "noble gas",
  lanthanide: (e) => e.category === "lanthanide",
  lanthanoid: (e) => e.category === "lanthanide",
  actinide: (e) => e.category === "actinide",
  actinoid: (e) => e.category === "actinide",
  metal: (e) => e.metal,
  "non-metal": (e) => !e.metal,
  nonmetal: (e) => !e.metal,
};

/** Singular form: "noble gases" → "noble gas", "halogens" → "halogen". */
function singular(word: string): string {
  if (word.endsWith("gases")) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/**
 * Turns one highlight word into a test on elements: "group 1", "group 0", "period 3", "Na", "sodium",
 * "halogens", "metals"… IUPAC groups 13–18 are accepted and mapped to UK groups 3–7 and 0.
 */
export function highlightMatcher(token: string): Matcher | { error: string } {
  const t = token.trim().toLowerCase().replace(/\s+/g, " ").replace(/^the /, "");
  const group = t.match(/^group ?(\d+)$/);
  if (group) {
    const n = Number(group[1]);
    const uk = n >= 13 && n <= 18 ? (n === 18 ? 0 : n - 10) : n;
    if (uk > 7) return { error: `"${token}": GCSE groups are 1–7 and 0 (the noble gases)` };
    return (e) => e.group === uk;
  }
  const period = t.match(/^period ?(\d+)$/);
  if (period) {
    const n = Number(period[1]);
    if (n < 1 || n > 7) return { error: `"${token}": periods run from 1 to 7` };
    return (e) => e.period === n;
  }
  const category = CATEGORY_WORDS[t] ?? CATEGORY_WORDS[singular(t)] ?? CATEGORY_WORDS[t.replace(/ elements?$/, "")];
  if (category) return category;
  const el = findElement(token);
  if (el) return (e) => e.z === el.z;
  return { error: `The periodic table can't highlight "${token}": use an element ("Na"), "group 1", "period 3", or a family like "halogens"` };
}

// ---------- info panel text ----------

export function groupText(el: ChemicalElement): string {
  if (el.group !== null) return el.group === 0 ? "0 (noble gases)" : String(el.group);
  if (el.z === 1) return "None (hydrogen isn't placed in a group)";
  if (el.category === "lanthanide" || el.category === "actinide") return `None (${el.category})`;
  return "None (transition metal)";
}

export function typeText(el: ChemicalElement): string {
  if (el.category === "metalloid") return "Metalloid (semi-metal)";
  if (el.metal) return el.category === "post-transition metal" ? "Metal" : `Metal (${el.category})`;
  return el.category === "non-metal" ? "Non-metal" : `Non-metal (${el.category})`;
}
