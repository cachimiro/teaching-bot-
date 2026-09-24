import { describe, expect, it } from "vitest";
import { circuitEntry, circuitValues, pointsAlong, validateCircuit } from "./circuit";
import { emSpectrumEntry, EM_BANDS, findBand } from "./em-spectrum";
import { acceleration, forcesEntry, resultantForce } from "./forces";
import { eqSign, fmtNum, readCircuitOptions, readForcesOptions, readWaveOptions, sliderRange } from "./physics";
import { featurePositions, ridingLabel, waveDisplacement, waveEntry, waveSpeed } from "./wave";

const validate = (entry: typeof waveEntry, spec: Record<string, unknown>) => {
  if (entry.kind !== "custom" || !entry.validate) throw new Error("expected a custom entry with validate()");
  return entry.validate(spec);
};

describe("wave maths", () => {
  it("computes v = f × λ", () => {
    expect(waveSpeed(1, 4)).toBe(4);
    expect(waveSpeed(340, 1)).toBe(340);
    expect(waveSpeed(0.5, 3)).toBe(1.5);
  });

  it("puts crests at a quarter wavelength and moves them right as the wave travels", () => {
    expect(featurePositions("crest", 12, 4, 0)).toEqual([1, 5, 9]);
    expect(featurePositions("trough", 12, 4, 0)).toEqual([3, 7, 11]);
    expect(featurePositions("crest", 12, 4, 0.25)).toEqual([2, 6, 10]);
    expect(waveDisplacement(1, 2, 4, 0)).toBeCloseTo(2);
    expect(waveDisplacement(3, 2, 4, 0)).toBeCloseTo(-2);
  });

  it("places compressions where particles either side move together", () => {
    const [c] = featurePositions("compression", 12, 4, 0);
    expect(c).toBe(2);
    // just behind the compression particles move forward (+), just ahead they move back (−)
    expect(waveDisplacement(c - 0.1, 1, 4, 0)).toBeGreaterThan(0);
    expect(waveDisplacement(c + 0.1, 1, 4, 0)).toBeLessThan(0);
    expect(featurePositions("rarefaction", 12, 4, 0)).toEqual([0, 4, 8, 12]);
  });

  it("fades riding labels smoothly between crests", () => {
    expect(ridingLabel(2.25, "crest", 0)).toEqual({ at: 2.25, opacity: 1 });
    expect(ridingLabel(2.25, "crest", 0.1).opacity).toBe(1);
    expect(ridingLabel(2.25, "crest", 0.45).opacity).toBeCloseTo(0.25);
    expect(ridingLabel(2.25, "crest", 1).at).toBe(2.25);
  });

  it("reads options with defaults", () => {
    expect(readWaveOptions({})).toEqual({ type: "transverse", amplitude: 2, wavelength: 4, frequency: 1, controls: true });
    expect(readWaveOptions({ type: "longitudinal", controls: false })).toMatchObject({ type: "longitudinal", controls: false });
  });
});

describe("circuit maths", () => {
  it("adds resistances in series and shares the p.d. in proportion to R", () => {
    const c = circuitValues("series", 6, [2, 4]);
    expect(c.totalResistance).toBe(6);
    expect(c.current).toBe(1);
    expect(c.resistors.map((r) => r.pd)).toEqual([2, 4]);
    expect(c.resistors.map((r) => r.current)).toEqual([1, 1]);
  });

  it("handles three resistors in series", () => {
    const c = circuitValues("series", 12, [1, 2, 3]);
    expect(c.totalResistance).toBe(6);
    expect(c.current).toBe(2);
    expect(c.resistors.map((r) => r.pd)).toEqual([2, 4, 6]);
    expect(c.resistors.reduce((s, r) => s + r.pd, 0)).toBe(12);
  });

  it("uses 1/R = 1/R1 + 1/R2 in parallel, with the full p.d. across each branch", () => {
    const c = circuitValues("parallel", 6, [2, 4]);
    expect(c.totalResistance).toBeCloseTo(4 / 3);
    expect(c.current).toBeCloseTo(4.5);
    expect(c.resistors.map((r) => r.current)).toEqual([3, 1.5]);
    expect(c.resistors.map((r) => r.pd)).toEqual([6, 6]);
    expect(c.totalResistance).toBeLessThan(2);
  });

  it("handles three resistors in parallel", () => {
    const c = circuitValues("parallel", 12, [2, 3, 6]);
    expect(c.totalResistance).toBeCloseTo(1);
    expect(c.current).toBeCloseTo(12);
    expect(c.resistors.map((r) => r.current)).toEqual([6, 4, 2]);
  });

  it("gives zero current with no p.d.", () => {
    expect(circuitValues("series", 0, [5]).current).toBe(0);
  });

  it("spaces charge dots evenly along a wire, continuing round corners", () => {
    const path: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
    ];
    expect(pointsAlong(path, 0, 5)).toEqual([
      [0, 0],
      [5, 0],
      [10, 0],
      [10, 5],
    ]);
    expect(pointsAlong(path, 7, 5)[0]).toEqual([2, 0]);
  });
});

describe("forces maths", () => {
  it("finds an unbalanced resultant along one axis", () => {
    const r = resultantForce([
      { label: "Thrust", size: 500, direction: "right" },
      { label: "Drag", size: 300, direction: "left" },
    ]);
    expect(r).toMatchObject({ x: 200, y: 0, size: 200, balanced: false, direction: "to the right", angle: 0 });
    expect(acceleration(r.size, 1000)).toBeCloseTo(0.2);
  });

  it("recognises balanced forces", () => {
    const r = resultantForce([
      { label: "Weight", size: 700, direction: "down" },
      { label: "Air resistance", size: 700, direction: "up" },
    ]);
    expect(r).toMatchObject({ size: 0, balanced: true, direction: "" });
  });

  it("adds forces in the same direction", () => {
    const r = resultantForce([
      { label: "Push", size: 100, direction: "left" },
      { label: "Wind", size: 50, direction: "left" },
      { label: "Friction", size: 30, direction: "right" },
    ]);
    expect(r).toMatchObject({ x: -120, size: 120, direction: "to the left" });
  });

  it("combines perpendicular forces by Pythagoras", () => {
    const r = resultantForce([
      { label: "Push", size: 300, direction: "right" },
      { label: "Lift", size: 400, direction: "up" },
    ]);
    expect(r.size).toBe(500);
    expect(r.direction).toBe("up and to the right");
    expect(r.angle).toBeCloseTo(53.13, 1);
    expect(resultantForce([{ label: "Weight", size: 10, direction: "down" }]).direction).toBe("downwards");
  });

  it("reads options, with sensible forces for each object when none are given", () => {
    expect(readForcesOptions({ object: "skydiver" }).forces.map((f) => f.direction)).toEqual(["down", "up"]);
    expect(readForcesOptions({ forces: [{ label: "Pull", size: 5, direction: "Right" }], mass: 2 })).toMatchObject({
      object: "box",
      forces: [{ label: "Pull", size: 5, direction: "right" }],
      mass: 2,
    });
  });
});

describe("number formatting and sliders", () => {
  it("formats numbers as a student would write them", () => {
    expect(fmtNum(4)).toBe("4");
    expect(fmtNum(4 / 3)).toBe("1.33");
    expect(fmtNum(0.1 + 0.2)).toBe("0.3");
    expect(fmtNum(12345)).toBe("12345");
    expect(fmtNum(-2.5)).toBe("−2.5");
    expect(fmtNum(3e8)).toBe("3 × 10⁸");
    expect(fmtNum(1e-10)).toBe("1 × 10⁻¹⁰");
    expect(eqSign(4.5)).toBe("=");
    expect(eqSign(4 / 3)).toBe("≈");
  });

  it("chooses slider steps that land exactly on the starting value", () => {
    expect(sliderRange(4, 2, 6)).toEqual({ min: 2, max: 6, step: 0.1 });
    expect(sliderRange(6, 0, 12, 24)).toEqual({ min: 0, max: 12, step: 0.5 });
    expect(sliderRange(500, 0, 1000)).toEqual({ min: 0, max: 1000, step: 20 });
    expect(sliderRange(250, 0, 1000).step).toBe(10);
    expect(sliderRange(2, 1, 20, 19)).toEqual({ min: 1, max: 20, step: 1 });
  });

  it("reads circuit options with defaults", () => {
    expect(readCircuitOptions({})).toEqual({ type: "series", voltage: 6, resistors: [2, 4], controls: true });
  });
});

describe("validate()", () => {
  it("wave: accepts good specs and rejects bad ones", () => {
    expect(validate(waveEntry, { name: "wave" })).toBeNull();
    expect(validate(waveEntry, { type: "longitudinal", amplitude: 1, wavelength: 0.5, frequency: 680, controls: false })).toBeNull();
    expect(validate(waveEntry, { type: "sideways" })).toMatch(/transverse/);
    expect(validate(waveEntry, { wavelength: -4 })).toMatch(/wavelength/);
    expect(validate(waveEntry, { frequency: "fast" })).toMatch(/frequency/);
    expect(validate(waveEntry, { controls: "yes" })).toMatch(/controls/);
  });

  it("circuit: accepts 1 to 3 positive resistors and rejects the rest", () => {
    expect(validate(circuitEntry, { type: "series", voltage: 6, resistors: [2, 4] })).toBeNull();
    expect(validate(circuitEntry, { type: "parallel", voltage: 12, resistors: [2, 3, 6] })).toBeNull();
    expect(validate(circuitEntry, { resistors: [10] })).toBeNull();
    expect(validate(circuitEntry, { resistors: [] })).toMatch(/1 to 3/);
    expect(validate(circuitEntry, { resistors: [1, 2, 3, 4] })).toMatch(/1 to 3/);
    expect(validate(circuitEntry, { resistors: [2, -4] })).toMatch(/positive/);
    expect(validate(circuitEntry, { resistors: [0] })).toMatch(/positive/);
    expect(validate(circuitEntry, { type: "loop" })).toMatch(/series/);
    expect(validate(circuitEntry, { voltage: -3 })).toMatch(/voltage/);
    expect(validateCircuit({ resistors: "2, 4" })).toMatch(/1 to 3/);
  });

  it("forces: accepts good specs and rejects unknown directions and bad sizes", () => {
    expect(
      validate(forcesEntry, {
        object: "car",
        forces: [
          { label: "Thrust", size: 500, direction: "right" },
          { label: "Drag", size: 300, direction: "left" },
        ],
        mass: 1000,
      }),
    ).toBeNull();
    expect(validate(forcesEntry, { object: "rocket" })).toBeNull();
    expect(validate(forcesEntry, { forces: [{ label: "Push", size: 10, direction: "north" }] })).toMatch(/direction/);
    expect(validate(forcesEntry, { forces: [{ label: "Push", size: 10, direction: "diagonal" }] })).toMatch(/north|direction/);
    expect(validate(forcesEntry, { forces: [{ label: "Push", size: -10, direction: "left" }] })).toMatch(/size/);
    expect(validate(forcesEntry, { forces: [{ size: 10, direction: "left" }] })).toMatch(/label/);
    expect(validate(forcesEntry, { forces: [] })).toMatch(/1 to 6/);
    expect(validate(forcesEntry, { object: "horse" })).toMatch(/object/);
    expect(validate(forcesEntry, { mass: 0 })).toMatch(/mass/);
  });

  it("em-spectrum: accepts known bands (and aliases) and rejects unknown ones", () => {
    expect(validate(emSpectrumEntry, {})).toBeNull();
    expect(validate(emSpectrumEntry, { highlight: "microwaves" })).toBeNull();
    expect(validate(emSpectrumEntry, { highlight: ["UV", "X-rays", "gamma rays", "visible light"] })).toBeNull();
    expect(validate(emSpectrumEntry, { highlight: "sound" })).toMatch(/sound/);
    expect(validate(emSpectrumEntry, { highlight: ["infrared", "cosmic rays"] })).toMatch(/cosmic rays/);
  });
});

describe("the EM spectrum data", () => {
  it("lists the seven bands from longest to shortest wavelength", () => {
    expect(EM_BANDS.map((b) => b.id)).toEqual(["radio", "microwaves", "infrared", "visible", "ultraviolet", "x-rays", "gamma"]);
  });

  it("finds bands by name or alias", () => {
    expect(findBand("Microwave")?.id).toBe("microwaves");
    expect(findBand("IR")?.id).toBe("infrared");
    expect(findBand("x-ray")?.id).toBe("x-rays");
    expect(findBand("Gamma rays")?.id).toBe("gamma");
    expect(findBand("radio waves")?.id).toBe("radio");
    expect(findBand("sound")).toBeUndefined();
  });

  it("marks X-rays and gamma rays as ionising, and gives uses and dangers for every band", () => {
    expect(EM_BANDS.filter((b) => b.ionising).map((b) => b.id)).toEqual(["x-rays", "gamma"]);
    for (const b of EM_BANDS) {
      expect(b.uses.length, b.id).toBeGreaterThan(0);
      expect(b.dangers.length, b.id).toBeGreaterThan(10);
    }
  });
});

describe("catalogue entries", () => {
  it("are custom physics entries with one-line description and options", () => {
    for (const entry of [waveEntry, circuitEntry, forcesEntry, emSpectrumEntry]) {
      expect(entry.kind).toBe("custom");
      if (entry.kind !== "custom") continue;
      expect(entry.subject).toBe("physics");
      expect(entry.description).not.toContain("\n");
      expect(entry.options).not.toContain("\n");
      expect(typeof entry.Component).toBe("function");
    }
    expect([waveEntry, circuitEntry, forcesEntry, emSpectrumEntry].map((e) => (e.kind === "custom" ? e.name : ""))).toEqual([
      "wave",
      "circuit",
      "forces",
      "em-spectrum",
    ]);
  });
});
