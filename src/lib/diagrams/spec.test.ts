import { describe, expect, it } from "vitest";
import { diagramBlockJson, parseDiagramSpec } from "./spec";
import { DIAGRAMS, diagramCatalogue } from "./registry";

describe("diagramBlockJson", () => {
  it("passes a diagram block through", () => {
    expect(diagramBlockJson("diagram", '{"name": "wave"}')).toBe('{"name": "wave"}');
  });

  it("treats a fence named after a diagram as that diagram", () => {
    expect(JSON.parse(diagramBlockJson("wave", '{"type": "transverse", "highlight": ["amplitude"]}')!)).toEqual({
      type: "transverse",
      highlight: ["amplitude"],
      name: "wave",
    });
    expect(diagramBlockJson("heart", "")).toBe('{"name":"heart"}');
  });

  it("ignores other fences", () => {
    expect(diagramBlockJson("graph", "{}")).toBeNull();
    expect(diagramBlockJson(undefined, "{}")).toBeNull();
  });
});

describe("parseDiagramSpec", () => {
  it("accepts a known diagram with highlight and mode", () => {
    const r = parseDiagramSpec('{"name": "animal-cell", "highlight": "mitochondrion", "mode": "labelled"}');
    expect(r).toMatchObject({ spec: { name: "animal-cell", highlight: ["mitochondrion"], mode: "labelled" } });
  });

  it("accepts a labelling quiz on chosen parts", () => {
    const r = parseDiagramSpec('{"name": "animal-cell", "mode": "quiz", "ask": ["nucleus", "ribosomes"]}');
    expect(r).toMatchObject({ spec: { mode: "quiz", ask: ["nucleus", "ribosomes"] } });
  });

  it("rejects unknown diagrams and unknown parts", () => {
    expect(parseDiagramSpec('{"name": "dragon"}')).toMatchObject({ error: expect.stringContaining("No diagram") });
    expect(parseDiagramSpec('{"name": "animal-cell", "highlight": ["chloroplast"]}')).toMatchObject({ error: expect.stringContaining("chloroplast") });
  });
});

describe("the diagram library", () => {
  it("gives every parts diagram unique part ids with labels inside the drawing area", () => {
    for (const entry of DIAGRAMS) {
      if (entry.kind !== "parts") continue;
      const [, , w, h] = entry.def.viewBox.split(" ").map(Number);
      const ids = entry.def.parts.map((p) => p.id);
      expect(new Set(ids).size, entry.def.name).toBe(ids.length);
      for (const p of entry.def.parts) {
        for (const [x, y] of [p.anchor, p.labelAt]) {
          expect(x, `${entry.def.name}/${p.id}`).toBeGreaterThanOrEqual(0);
          expect(x, `${entry.def.name}/${p.id}`).toBeLessThanOrEqual(w);
          expect(y, `${entry.def.name}/${p.id}`).toBeGreaterThanOrEqual(0);
          expect(y, `${entry.def.name}/${p.id}`).toBeLessThanOrEqual(h);
        }
      }
    }
  });

  it("describes every diagram in the tutor's catalogue", () => {
    const catalogue = diagramCatalogue();
    for (const entry of DIAGRAMS) expect(catalogue).toContain(entry.kind === "parts" ? entry.def.name : entry.name);
  });
});
