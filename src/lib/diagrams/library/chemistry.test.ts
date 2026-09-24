import { describe, expect, it } from "vitest";
import { ELEMENTS, electronConfig, findElement, formatMass, massNumber, neutrons, tableColumn } from "../data/elements";
import { atomEntry, ionFormula, parseCharge, resolveAtom } from "./atom";
import { cellPosition, highlightMatcher, periodicTableEntry } from "./periodic-table";
import { BOX_H, BOX_W, COUNT, RADIUS, createSim, particlesEntry, phaseAt, stepSim, type Phase, type Sim } from "./particles";
import type { DiagramEntry } from "../types";

function validator(entry: DiagramEntry) {
  if (entry.kind !== "custom" || !entry.validate) throw new Error("expected a custom entry with validate()");
  return entry.validate;
}

describe("element data", () => {
  it("has all 118 elements with unique atomic numbers 1–118 in order", () => {
    expect(ELEMENTS).toHaveLength(118);
    expect(ELEMENTS.map((e) => e.z)).toEqual(Array.from({ length: 118 }, (_, i) => i + 1));
    expect(new Set(ELEMENTS.map((e) => e.symbol)).size).toBe(118);
    expect(new Set(ELEMENTS.map((e) => e.name)).size).toBe(118);
  });

  it("uses the relative atomic masses printed on GCSE periodic tables", () => {
    const masses: Record<string, number> = {
      H: 1,
      He: 4,
      C: 12,
      O: 16,
      Na: 23,
      Cl: 35.5,
      Fe: 56,
      Cu: 63.5,
      Br: 80,
      I: 127,
      Au: 197,
      U: 238,
    };
    for (const [symbol, mass] of Object.entries(masses)) expect(findElement(symbol)?.mass, symbol).toBe(mass);
  });

  it("gives key elements their names and periods", () => {
    expect(findElement("H")).toMatchObject({ name: "Hydrogen", period: 1, category: "non-metal", metal: false });
    expect(findElement("He")).toMatchObject({ name: "Helium", period: 1, group: 0, category: "noble gas" });
    expect(findElement("Na")).toMatchObject({ name: "Sodium", period: 3, category: "alkali metal", metal: true });
    expect(findElement("Fe")).toMatchObject({ name: "Iron", period: 4, category: "transition metal", metal: true });
    expect(findElement("Br")).toMatchObject({ name: "Bromine", period: 4, category: "halogen", metal: false });
    expect(findElement("I")).toMatchObject({ name: "Iodine", period: 5, category: "halogen" });
    expect(findElement("Au")).toMatchObject({ name: "Gold", z: 79, period: 6 });
    expect(findElement("U")).toMatchObject({ name: "Uranium", z: 92, period: 7, category: "actinide", group: null });
    expect(findElement("Al")?.name).toBe("Aluminium");
    expect(findElement("S")?.name).toBe("Sulfur");
  });

  it("uses UK GCSE group numbers (1–7, 0) and no group for transition metals", () => {
    const groups: Record<string, number | null> = { Na: 1, Mg: 2, Al: 3, C: 4, N: 5, O: 6, Cl: 7, Ar: 0, Fe: null, Cu: null, Xe: 0, K: 1 };
    for (const [symbol, group] of Object.entries(groups)) expect(findElement(symbol)?.group, symbol).toBe(group);
    // GCSE tables don't put hydrogen in group 1.
    expect(findElement("H")?.group).toBeNull();
    for (const e of ELEMENTS) {
      if (e.category === "transition metal" || e.category === "lanthanide" || e.category === "actinide") expect(e.group, e.symbol).toBeNull();
      if (e.category === "noble gas") expect(e.group, e.symbol).toBe(0);
      if (e.category === "halogen") expect(e.group, e.symbol).toBe(7);
      if (e.category === "alkali metal") expect(e.group, e.symbol).toBe(1);
    }
  });

  it("places every element in the 18-column layout without collisions", () => {
    expect(tableColumn(1)).toBe(1);
    expect(tableColumn(2)).toBe(18);
    expect(tableColumn(57)).toBe(3);
    expect(tableColumn(72)).toBe(4);
    expect(tableColumn(58)).toBeNull();
    const cells = ELEMENTS.map((e) => {
      const { x, y } = cellPosition(e);
      return `${x},${y}`;
    });
    expect(new Set(cells).size).toBe(118);
  });

  it("works out GCSE electron configurations (2,8,8,2)", () => {
    expect(electronConfig(1)).toEqual([1]);
    expect(electronConfig(2)).toEqual([2]);
    expect(electronConfig(3)).toEqual([2, 1]);
    expect(electronConfig(10)).toEqual([2, 8]);
    expect(electronConfig(11)).toEqual([2, 8, 1]);
    expect(electronConfig(17)).toEqual([2, 8, 7]);
    expect(electronConfig(18)).toEqual([2, 8, 8]);
    expect(electronConfig(19)).toEqual([2, 8, 8, 1]);
    expect(electronConfig(20)).toEqual([2, 8, 8, 2]);
    expect(electronConfig(0)).toEqual([]);
    expect(electronConfig(21)).toBeNull();
  });

  it("counts neutrons from the rounded mass", () => {
    expect(massNumber(11)).toBe(23);
    expect(neutrons(11)).toBe(12);
    expect(massNumber(17)).toBe(35);
    expect(neutrons(17)).toBe(18);
    expect(massNumber(29)).toBe(63);
    expect(neutrons(1)).toBe(0);
    expect(neutrons(6)).toBe(6);
  });

  it("prints masses like a GCSE table, with brackets for elements with no stable isotope", () => {
    expect(formatMass(findElement("Cl")!)).toBe("35.5");
    expect(formatMass(findElement("Tc")!)).toBe("[98]");
    expect(formatMass(findElement("U")!)).toBe("238");
  });

  it("finds elements by symbol (any case), name or atomic number", () => {
    expect(findElement("Na")?.z).toBe(11);
    expect(findElement("na")?.z).toBe(11);
    expect(findElement("NA")?.z).toBe(11);
    expect(findElement("sodium")?.z).toBe(11);
    expect(findElement(" Sodium ")?.z).toBe(11);
    expect(findElement(11)?.symbol).toBe("Na");
    expect(findElement("11")?.symbol).toBe("Na");
    expect(findElement("sulphur")?.symbol).toBe("S");
    expect(findElement("aluminum")?.symbol).toBe("Al");
    expect(findElement(118)?.symbol).toBe("Og");
    expect(findElement(0)).toBeUndefined();
    expect(findElement(119)).toBeUndefined();
    expect(findElement("Xx")).toBeUndefined();
    expect(findElement("")).toBeUndefined();
  });
});

describe("atom diagram", () => {
  const validate = validator(atomEntry);

  it("accepts atoms and ions of elements 1–20", () => {
    expect(validate({ name: "atom", element: "Na" })).toBeNull();
    expect(validate({ name: "atom", element: "sodium", charge: 1 })).toBeNull();
    expect(validate({ name: "atom", element: 17, charge: -1, highlight: ["outer shell"] })).toBeNull();
    expect(validate({ name: "atom", element: "O", charge: "2-" })).toBeNull();
    expect(validate({ name: "atom", element: "Ca", highlight: "nucleus", mode: "blank" })).toBeNull();
    expect(validate({ name: "atom", element: "H", charge: 1 })).toBeNull();
  });

  it("rejects elements beyond 20, missing elements, big charges and unknown highlights", () => {
    expect(validate({ name: "atom", element: 26 })).toMatch(/1–20/);
    expect(validate({ name: "atom", element: "Fe" })).toMatch(/1–20/);
    expect(validate({ name: "atom" })).toMatch(/element/);
    expect(validate({ name: "atom", element: "Zz" })).toMatch(/No element/);
    expect(validate({ name: "atom", element: "Na", charge: 5 })).toMatch(/−3 to \+3/);
    expect(validate({ name: "atom", element: "Na", charge: 1.5 })).toMatch(/whole number/);
    expect(validate({ name: "atom", element: "H", charge: 2 })).toMatch(/only 1 electron/);
    expect(validate({ name: "atom", element: "Ca", charge: -3 })).toMatch(/beyond/);
    expect(validate({ name: "atom", element: "Na", highlight: ["mitochondria"] })).toMatch(/highlight/);
  });

  it("works out ions: Na⁺ is 2,8 and Cl⁻ is 2,8,8 with one gained electron", () => {
    expect(resolveAtom({ element: "Na", charge: 1 })).toMatchObject({ electrons: 10, shells: [2, 8], neutrons: 12, gained: 0 });
    expect(resolveAtom({ element: "Cl", charge: -1 })).toMatchObject({ electrons: 18, shells: [2, 8, 8], neutrons: 18, gained: 1 });
    expect(resolveAtom({ element: "Mg", charge: "2+" })).toMatchObject({ shells: [2, 8] });
    expect(resolveAtom({ element: "K" })).toMatchObject({ shells: [2, 8, 8, 1], neutrons: 20 });
  });

  it("reads charges written in different ways and writes ion formulae", () => {
    expect(parseCharge(undefined)).toBe(0);
    expect(parseCharge(2)).toBe(2);
    expect(parseCharge("+1")).toBe(1);
    expect(parseCharge("2+")).toBe(2);
    expect(parseCharge("-")).toBe(-1);
    expect(parseCharge("3−")).toBe(-3);
    expect(parseCharge("+2-")).toBeNull();
    expect(parseCharge("two")).toBeNull();
    expect(ionFormula("Na", 1)).toBe("Na⁺");
    expect(ionFormula("O", -2)).toBe("O²⁻");
    expect(ionFormula("Al", 3)).toBe("Al³⁺");
  });
});

describe("periodic table", () => {
  const validate = validator(periodicTableEntry);
  const lit = (token: string) => {
    const m = highlightMatcher(token);
    if (typeof m !== "function") throw new Error(m.error);
    return ELEMENTS.filter(m).map((e) => e.symbol);
  };

  it("accepts groups, periods, elements and families", () => {
    expect(validate({ name: "periodic-table" })).toBeNull();
    expect(
      validate({
        name: "periodic-table",
        highlight: ["group 1", "group 7", "group 0", "period 3", "Na", "noble gases", "halogens", "alkali metals", "transition metals", "metals", "non-metals"],
      }),
    ).toBeNull();
    expect(validate({ name: "periodic-table", highlight: "sodium", select: "Na" })).toBeNull();
  });

  it("rejects things it can't highlight", () => {
    expect(validate({ name: "periodic-table", highlight: ["group 9"] })).toMatch(/1–7 and 0/);
    expect(validate({ name: "periodic-table", highlight: ["period 8"] })).toMatch(/periods/);
    expect(validate({ name: "periodic-table", highlight: ["unicorns"] })).toMatch(/can't highlight/);
    expect(validate({ name: "periodic-table", select: "Zz" })).toMatch(/select/);
  });

  it("highlights the right elements", () => {
    expect(lit("group 1")).toEqual(["Li", "Na", "K", "Rb", "Cs", "Fr"]);
    expect(lit("group 7")).toEqual(["F", "Cl", "Br", "I", "At", "Ts"]);
    expect(lit("group 0")).toEqual(["He", "Ne", "Ar", "Kr", "Xe", "Rn", "Og"]);
    expect(lit("group 18")).toEqual(lit("group 0"));
    expect(lit("period 3")).toEqual(["Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar"]);
    expect(lit("halogens")).toEqual(lit("group 7"));
    expect(lit("Noble Gases")).toEqual(lit("group 0"));
    expect(lit("alkali metals")).toEqual(lit("group 1"));
    expect(lit("Na")).toEqual(["Na"]);
    expect(lit("transition metals")).toContain("Fe");
    expect(lit("transition metals")).not.toContain("Al");
    expect(lit("metals")).toContain("Na");
    expect(lit("metals")).not.toContain("C");
    expect(lit("non-metals")).toContain("C");
    expect(lit("non-metals")).not.toContain("Fe");
  });
});

describe("particle model", () => {
  const validate = validator(particlesEntry);

  it("accepts the states and the controls flag", () => {
    expect(validate({ name: "particles" })).toBeNull();
    for (const state of ["solid", "liquid", "gas", "all"]) expect(validate({ name: "particles", state })).toBeNull();
    expect(validate({ name: "particles", state: "solid", controls: true })).toBeNull();
  });

  it("rejects unknown states and non-boolean controls", () => {
    expect(validate({ name: "particles", state: "plasma" })).toMatch(/state/);
    expect(validate({ name: "particles", state: "gas", controls: "yes" })).toMatch(/controls/);
  });

  it("maps slider temperature to solid, liquid and gas", () => {
    expect(phaseAt(0).phase).toBe("solid");
    expect(phaseAt(50).phase).toBe("liquid");
    expect(phaseAt(100).phase).toBe("gas");
  });

  const inside = (sim: Sim) => sim.ps.every((p) => p.x >= RADIUS - 1e-6 && p.x <= BOX_W - RADIUS + 1e-6 && p.y >= RADIUS - 1e-6 && p.y <= BOX_H - RADIUS + 1e-6);
  const closest = (sim: Sim) => {
    let min = Infinity;
    sim.ps.forEach((a, i) => sim.ps.slice(i + 1).forEach((b) => (min = Math.min(min, Math.hypot(a.x - b.x, a.y - b.y)))));
    return min;
  };

  it("starts each state from the same seeded, non-overlapping arrangement", () => {
    for (const phase of ["solid", "liquid", "gas"] as Phase[]) {
      const a = createSim(phase, 5);
      const b = createSim(phase, 5);
      expect(a.ps).toHaveLength(COUNT);
      expect(a.ps.map((p) => [p.x, p.y])).toEqual(b.ps.map((p) => [p.x, p.y]));
      expect(inside(a), phase).toBe(true);
      expect(closest(a), phase).toBeGreaterThan(2 * RADIUS - 1);
    }
  });

  it("keeps liquids at the bottom and spreads gases through the container", () => {
    const liquid = createSim("liquid", 5);
    expect(Math.min(...liquid.ps.map((p) => p.y))).toBeGreaterThan(BOX_H / 2);
    const gas = createSim("gas", 5);
    const ys = gas.ps.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(BOX_H * 0.7);
  });

  it("stays inside the container through melting, boiling, condensing and freezing", () => {
    const sim = createSim("solid", 7);
    for (const phase of ["liquid", "gas", "liquid", "solid", "gas", "solid"] as Phase[]) {
      for (let i = 0; i < 180; i++) stepSim(sim, phase, 0.6, 1);
      expect(inside(sim), phase).toBe(true);
      expect(sim.ps.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
    }
  });
});
