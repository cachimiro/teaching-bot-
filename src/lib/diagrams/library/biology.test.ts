import { describe, expect, it } from "vitest";
import type { PartsDiagramDef } from "../types";
import { bacterialCell } from "./bacterial-cell";
import { heart } from "./heart";
import { leaf } from "./leaf";
import { plantCell } from "./plant-cell";

const CASES: { def: PartsDiagramDef; name: string; ids: string[] }[] = [
  {
    def: plantCell,
    name: "plant-cell",
    ids: ["cell-wall", "cell-membrane", "cytoplasm", "nucleus", "chloroplasts", "permanent-vacuole", "mitochondria", "ribosomes"],
  },
  {
    def: bacterialCell,
    name: "bacterial-cell",
    ids: ["cell-wall", "cell-membrane", "cytoplasm", "chromosomal-dna", "plasmids", "ribosomes", "flagellum"],
  },
  {
    def: heart,
    name: "heart",
    ids: [
      "right-atrium",
      "left-atrium",
      "right-ventricle",
      "left-ventricle",
      "vena-cava",
      "pulmonary-artery",
      "pulmonary-vein",
      "aorta",
      "valves",
    ],
  },
  {
    def: leaf,
    name: "leaf",
    ids: [
      "waxy-cuticle",
      "upper-epidermis",
      "palisade-mesophyll",
      "spongy-mesophyll",
      "air-spaces",
      "lower-epidermis",
      "stomata",
      "guard-cells",
      "xylem",
      "phloem",
    ],
  },
];

/** Must match the renderer (parts-diagram.tsx): 15px labels, leader starts 6px from the text, at y - 5. */
const FONT = 15;
const LEADER_GAP = 6;

/** Rough label width in px (Inter-like advance widths, padded for the bold weight used when highlighted). */
function labelWidth(text: string): number {
  let em = 0;
  for (const ch of text) {
    if ("il.,'|!:;".includes(ch)) em += 0.25;
    else if (ch === " ") em += 0.27;
    else if ("fjt".includes(ch)) em += 0.33;
    else if (ch === "r" || ch === "I") em += 0.36;
    else if (ch === "m") em += 0.86;
    else if (ch === "w") em += 0.76;
    else if (ch === "M" || ch === "W") em += 0.95;
    else if (ch >= "A" && ch <= "Z") em += 0.7;
    else em += 0.57;
  }
  return em * FONT * 1.06;
}

type Box = { x0: number; y0: number; x1: number; y1: number };

function labelBox(p: PartsDiagramDef["parts"][number]): Box {
  const [lx, ly] = p.labelAt;
  const w = labelWidth(p.label);
  return { x0: p.align === "end" ? lx - w : lx, x1: p.align === "end" ? lx : lx + w, y0: ly - 11, y1: ly + 4 };
}

function leader(p: PartsDiagramDef["parts"][number]): [[number, number], [number, number]] {
  const [lx, ly] = p.labelAt;
  return [[p.align === "end" ? lx + LEADER_GAP : lx - LEADER_GAP, ly - FONT / 3], p.anchor];
}

function segmentsCross([a, b]: [number, number][], [c, d]: [number, number][]): boolean {
  const orient = (p: number[], q: number[], r: number[]) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0;
}

function segmentHitsBox([a, b]: [number, number][], box: Box): boolean {
  const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
  for (let i = 0; i <= steps; i++) {
    const x = a[0] + ((b[0] - a[0]) * i) / steps;
    const y = a[1] + ((b[1] - a[1]) * i) / steps;
    if (x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1) return true;
  }
  return false;
}

describe.each(CASES)("$name diagram", ({ def, name, ids }) => {
  const [, , w, h] = def.viewBox.split(" ").map(Number);

  it("has the expected name and exactly the expected parts, with unique ids", () => {
    expect(def.name).toBe(name);
    const actual = def.parts.map((p) => p.id);
    expect(new Set(actual).size).toBe(actual.length);
    expect([...actual].sort()).toEqual([...ids].sort());
  });

  it("keeps every anchor and label position inside the viewBox", () => {
    for (const p of def.parts) {
      for (const [x, y] of [p.anchor, p.labelAt]) {
        expect(x, p.id).toBeGreaterThanOrEqual(0);
        expect(x, p.id).toBeLessThanOrEqual(w);
        expect(y, p.id).toBeGreaterThanOrEqual(0);
        expect(y, p.id).toBeLessThanOrEqual(h);
      }
    }
  });

  it("puts left labels on the left (align end) and right labels on the right (align start)", () => {
    for (const p of def.parts) {
      expect(p.align, p.id).toBe(p.labelAt[0] < w / 2 ? "end" : "start");
      // The label sits outside the drawing: on its own side of the anchor.
      if (p.align === "end") expect(p.labelAt[0], p.id).toBeLessThan(p.anchor[0]);
      else expect(p.labelAt[0], p.id).toBeGreaterThan(p.anchor[0]);
    }
  });

  it("spaces labels on the same side at least 30px apart vertically", () => {
    for (const side of ["start", "end"] as const) {
      const ys = def.parts
        .filter((p) => p.align === side)
        .map((p) => p.labelAt[1])
        .sort((a, b) => a - b);
      for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1], `${side} labels at y=${ys[i - 1]} and y=${ys[i]}`).toBeGreaterThanOrEqual(30);
    }
  });

  it("fits every label's text inside the viewBox (even in bold)", () => {
    for (const p of def.parts) {
      const box = labelBox(p);
      expect(box.x0, p.label).toBeGreaterThanOrEqual(2);
      expect(box.x1, p.label).toBeLessThanOrEqual(w - 2);
    }
  });

  it("never crosses two leader lines or runs a leader line through another label", () => {
    for (const p of def.parts) {
      for (const q of def.parts) {
        if (p === q) continue;
        expect(segmentsCross(leader(p), leader(q)), `${p.id} x ${q.id}`).toBe(false);
        expect(segmentHitsBox(leader(p), labelBox(q)), `${p.id} leader through "${q.label}"`).toBe(false);
      }
    }
  });

  it("gives every name the tutor can use (id, label, alias) to exactly one part", () => {
    const owner = new Map<string, string>();
    for (const p of def.parts) {
      for (const n of new Set([p.id, p.label.toLowerCase(), ...(p.aliases ?? []).map((a) => a.toLowerCase())])) {
        expect(owner.get(n) ?? p.id, `"${n}" used by ${owner.get(n)} and ${p.id}`).toBe(p.id);
        owner.set(n, p.id);
      }
    }
  });
});
