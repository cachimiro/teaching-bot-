/**
 * The 118 elements, with the values a UK GCSE student sees on an AQA/Edexcel/OCR periodic table.
 *
 * - mass: relative atomic mass as printed on a GCSE data sheet (H 1, Cl 35.5, Cu 63.5). For elements
 *   with no stable isotope it is the mass number of the longest-lived isotope, which exam boards print
 *   in square brackets (see formatMass).
 * - group: UK GCSE numbering: 1–7, and 0 for the noble gases. null for the transition metals, the
 *   lanthanides and actinides, and hydrogen (which GCSE tables don't place in a group).
 * - Layout follows the AQA table: La and Ac sit in the main table under Y; Ce–Lu and Th–Lr are the
 *   two separate rows below it.
 */

export type ElementCategory =
  | "alkali metal"
  | "alkaline earth metal"
  | "transition metal"
  | "post-transition metal"
  | "metalloid"
  | "non-metal"
  | "halogen"
  | "noble gas"
  | "lanthanide"
  | "actinide";

export type ChemicalElement = {
  z: number;
  symbol: string;
  name: string;
  mass: number;
  group: number | null;
  period: number;
  category: ElementCategory;
  metal: boolean;
};

const AM = "alkali metal";
const AE = "alkaline earth metal";
const TM = "transition metal";
const PT = "post-transition metal";
const MD = "metalloid";
const NM = "non-metal";
const HA = "halogen";
const NG = "noble gas";
const LA = "lanthanide";
const AC = "actinide";

/** [symbol, name, relative atomic mass, category], in atomic-number order. */
const DATA: [string, string, number, ElementCategory][] = [
  ["H", "Hydrogen", 1, NM],
  ["He", "Helium", 4, NG],
  ["Li", "Lithium", 7, AM],
  ["Be", "Beryllium", 9, AE],
  ["B", "Boron", 11, MD],
  ["C", "Carbon", 12, NM],
  ["N", "Nitrogen", 14, NM],
  ["O", "Oxygen", 16, NM],
  ["F", "Fluorine", 19, HA],
  ["Ne", "Neon", 20, NG],
  ["Na", "Sodium", 23, AM],
  ["Mg", "Magnesium", 24, AE],
  ["Al", "Aluminium", 27, PT],
  ["Si", "Silicon", 28, MD],
  ["P", "Phosphorus", 31, NM],
  ["S", "Sulfur", 32, NM],
  ["Cl", "Chlorine", 35.5, HA],
  ["Ar", "Argon", 40, NG],
  ["K", "Potassium", 39, AM],
  ["Ca", "Calcium", 40, AE],
  ["Sc", "Scandium", 45, TM],
  ["Ti", "Titanium", 48, TM],
  ["V", "Vanadium", 51, TM],
  ["Cr", "Chromium", 52, TM],
  ["Mn", "Manganese", 55, TM],
  ["Fe", "Iron", 56, TM],
  ["Co", "Cobalt", 59, TM],
  ["Ni", "Nickel", 59, TM],
  ["Cu", "Copper", 63.5, TM],
  ["Zn", "Zinc", 65, TM],
  ["Ga", "Gallium", 70, PT],
  ["Ge", "Germanium", 73, MD],
  ["As", "Arsenic", 75, MD],
  ["Se", "Selenium", 79, NM],
  ["Br", "Bromine", 80, HA],
  ["Kr", "Krypton", 84, NG],
  ["Rb", "Rubidium", 85, AM],
  ["Sr", "Strontium", 88, AE],
  ["Y", "Yttrium", 89, TM],
  ["Zr", "Zirconium", 91, TM],
  ["Nb", "Niobium", 93, TM],
  ["Mo", "Molybdenum", 96, TM],
  ["Tc", "Technetium", 98, TM],
  ["Ru", "Ruthenium", 101, TM],
  ["Rh", "Rhodium", 103, TM],
  ["Pd", "Palladium", 106, TM],
  ["Ag", "Silver", 108, TM],
  ["Cd", "Cadmium", 112, TM],
  ["In", "Indium", 115, PT],
  ["Sn", "Tin", 119, PT],
  ["Sb", "Antimony", 122, MD],
  ["Te", "Tellurium", 128, MD],
  ["I", "Iodine", 127, HA],
  ["Xe", "Xenon", 131, NG],
  ["Cs", "Caesium", 133, AM],
  ["Ba", "Barium", 137, AE],
  ["La", "Lanthanum", 139, LA],
  ["Ce", "Cerium", 140, LA],
  ["Pr", "Praseodymium", 141, LA],
  ["Nd", "Neodymium", 144, LA],
  ["Pm", "Promethium", 145, LA],
  ["Sm", "Samarium", 150, LA],
  ["Eu", "Europium", 152, LA],
  ["Gd", "Gadolinium", 157, LA],
  ["Tb", "Terbium", 159, LA],
  ["Dy", "Dysprosium", 162.5, LA],
  ["Ho", "Holmium", 165, LA],
  ["Er", "Erbium", 167, LA],
  ["Tm", "Thulium", 169, LA],
  ["Yb", "Ytterbium", 173, LA],
  ["Lu", "Lutetium", 175, LA],
  ["Hf", "Hafnium", 178, TM],
  ["Ta", "Tantalum", 181, TM],
  ["W", "Tungsten", 184, TM],
  ["Re", "Rhenium", 186, TM],
  ["Os", "Osmium", 190, TM],
  ["Ir", "Iridium", 192, TM],
  ["Pt", "Platinum", 195, TM],
  ["Au", "Gold", 197, TM],
  ["Hg", "Mercury", 201, TM],
  ["Tl", "Thallium", 204, PT],
  ["Pb", "Lead", 207, PT],
  ["Bi", "Bismuth", 209, PT],
  ["Po", "Polonium", 209, PT],
  ["At", "Astatine", 210, HA],
  ["Rn", "Radon", 222, NG],
  ["Fr", "Francium", 223, AM],
  ["Ra", "Radium", 226, AE],
  ["Ac", "Actinium", 227, AC],
  ["Th", "Thorium", 232, AC],
  ["Pa", "Protactinium", 231, AC],
  ["U", "Uranium", 238, AC],
  ["Np", "Neptunium", 237, AC],
  ["Pu", "Plutonium", 244, AC],
  ["Am", "Americium", 243, AC],
  ["Cm", "Curium", 247, AC],
  ["Bk", "Berkelium", 247, AC],
  ["Cf", "Californium", 251, AC],
  ["Es", "Einsteinium", 252, AC],
  ["Fm", "Fermium", 257, AC],
  ["Md", "Mendelevium", 258, AC],
  ["No", "Nobelium", 259, AC],
  ["Lr", "Lawrencium", 262, AC],
  ["Rf", "Rutherfordium", 261, TM],
  ["Db", "Dubnium", 262, TM],
  ["Sg", "Seaborgium", 266, TM],
  ["Bh", "Bohrium", 264, TM],
  ["Hs", "Hassium", 277, TM],
  ["Mt", "Meitnerium", 268, TM],
  ["Ds", "Darmstadtium", 271, TM],
  ["Rg", "Roentgenium", 272, TM],
  ["Cn", "Copernicium", 285, TM],
  ["Nh", "Nihonium", 286, PT],
  ["Fl", "Flerovium", 289, PT],
  ["Mc", "Moscovium", 289, PT],
  ["Lv", "Livermorium", 293, PT],
  ["Ts", "Tennessine", 294, HA],
  ["Og", "Oganesson", 294, NG],
];

/** Last atomic number in each period. */
const PERIOD_ENDS = [2, 10, 18, 36, 54, 86, 118];

function periodOf(z: number): number {
  return PERIOD_ENDS.findIndex((end) => z <= end) + 1;
}

/** True for the lanthanide and actinide rows drawn below the main table (Ce–Lu, Th–Lr). */
export function isFBlockRow(z: number): boolean {
  return (z >= 58 && z <= 71) || (z >= 90 && z <= 103);
}

/**
 * Column (1–18) in the standard 18-column table, or null for the separate lanthanide/actinide rows.
 * La and Ac sit in column 3, as on the AQA and Edexcel tables.
 */
export function tableColumn(z: number): number | null {
  if (z === 1) return 1;
  if (z === 2) return 18;
  if (isFBlockRow(z)) return null;
  const period = periodOf(z);
  const start = [1, 3, 11, 19, 37, 55, 87][period - 1];
  const offset = z - start;
  if (period <= 3) return offset < 2 ? offset + 1 : offset + 11;
  if (period <= 5) return offset + 1;
  // Periods 6 and 7: s-block, then La/Ac in column 3, then (after the f-block rows) columns 4–18.
  if (offset <= 2) return offset + 1;
  return offset - 14 + 1;
}

/** UK GCSE group number from the 18-column position: 1, 2, 3–7, 0; null in the middle block. */
function groupOf(z: number): number | null {
  if (z === 1) return null;
  const col = tableColumn(z);
  if (col === null) return null;
  if (col <= 2) return col;
  if (col >= 13 && col <= 17) return col - 10;
  if (col === 18) return 0;
  return null;
}

const METAL_CATEGORIES: ElementCategory[] = [AM, AE, TM, PT, LA, AC];

export const ELEMENTS: ChemicalElement[] = DATA.map(([symbol, name, mass, category], i) => ({
  z: i + 1,
  symbol,
  name,
  mass,
  group: groupOf(i + 1),
  period: periodOf(i + 1),
  category,
  metal: METAL_CATEGORIES.includes(category),
}));

/** Other spellings a student or tutor might use. */
const ALIASES: Record<string, number> = {
  aluminum: 13,
  sulphur: 16,
  cesium: 55,
  wolfram: 74,
};

/** Finds an element by symbol (any case), name, or atomic number ("Na", "sodium", 11, "11"). */
export function findElement(query: string | number): ChemicalElement | undefined {
  if (typeof query === "number") return Number.isInteger(query) ? ELEMENTS[query - 1] : undefined;
  const q = query.trim();
  if (!q) return undefined;
  if (/^\d+$/.test(q)) return ELEMENTS[Number(q) - 1];
  const lower = q.toLowerCase();
  const alias = ALIASES[lower];
  if (alias) return ELEMENTS[alias - 1];
  return ELEMENTS.find((e) => e.symbol.toLowerCase() === lower || e.name.toLowerCase() === lower);
}

/**
 * Electron shells by the GCSE rule (2, 8, 8, 2) for 0–20 electrons: electronConfig(11) → [2, 8, 1].
 * Pass the number of electrons (the atomic number for a neutral atom). null outside 0–20.
 */
export function electronConfig(electrons: number): number[] | null {
  if (!Number.isInteger(electrons) || electrons < 0 || electrons > 20) return null;
  const shells: number[] = [];
  let left = electrons;
  for (const capacity of [2, 8, 8, 2]) {
    if (left <= 0) break;
    shells.push(Math.min(capacity, left));
    left -= capacity;
  }
  return shells;
}

/**
 * The mass number GCSE students use to count neutrons: the printed relative atomic mass, rounded,
 * with the .5 values rounded down to the most common isotope (Cl 35.5 → 35, Cu 63.5 → 63).
 * neutrons = massNumber(z) − z.
 */
export function massNumber(z: number): number {
  const el = ELEMENTS[z - 1];
  if (!el) throw new RangeError(`No element with atomic number ${z}`);
  return el.mass % 1 === 0.5 ? Math.floor(el.mass) : Math.round(el.mass);
}

/** Neutrons in the (most common) atom: mass number − atomic number. */
export function neutrons(z: number): number {
  return massNumber(z) - z;
}

/** True when the element has no stable isotope, so exam boards print its mass in brackets: [98]. */
export function massIsBracketed(z: number): boolean {
  return z === 43 || z === 61 || (z >= 84 && z <= 89) || z >= 93;
}

/** The mass as a GCSE table prints it: "23", "35.5", "[98]". */
export function formatMass(el: ChemicalElement): string {
  return massIsBracketed(el.z) ? `[${el.mass}]` : String(el.mass);
}
