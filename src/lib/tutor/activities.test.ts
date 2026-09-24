import { describe, expect, it } from "vitest";
import {
  LESSON_STAGES,
  boxGaps,
  checkGap,
  gapsInsideBraces,
  latestLessonStage,
  parseActivity,
  parseGaps,
  parseLessonStage,
  scrambled,
  stripGaps,
} from "./activities";

describe("parseActivity: quiz", () => {
  it("accepts a multiple-choice question with a valid answer index", () => {
    const a = parseActivity("quiz", '{"question": "Which organelle releases energy?", "options": ["Nucleus", "Mitochondria", "Ribosome"], "answer": 1, "explain": "Respiration happens in mitochondria."}');
    expect(a).toMatchObject({ kind: "quiz", spec: { answer: 1, options: ["Nucleus", "Mitochondria", "Ribosome"] } });
  });

  it("rejects an answer index that doesn't exist", () => {
    expect(parseActivity("quiz", '{"question": "Q?", "options": ["A", "B"], "answer": 2}')).toMatchObject({ kind: "error" });
  });
});

describe("parseActivity: order", () => {
  it("accepts steps listed in the correct order", () => {
    const a = parseActivity("order", '{"prompt": "Put the stages of mitosis in order", "items": ["Prophase", "Metaphase", "Anaphase", "Telophase"]}');
    expect(a).toMatchObject({ kind: "order", spec: { items: ["Prophase", "Metaphase", "Anaphase", "Telophase"] } });
  });

  it("also accepts a simple 'key: value' layout instead of JSON", () => {
    const a = parseActivity("order", "prompt: Put the path of blood in order\nitems: Vena cava, Right atrium, Right ventricle, Pulmonary artery");
    expect(a).toMatchObject({ kind: "order", spec: { prompt: "Put the path of blood in order", items: ["Vena cava", "Right atrium", "Right ventricle", "Pulmonary artery"] } });
    const b = parseActivity("order", "prompt: Mitosis\nitems:\n- Prophase\n- Metaphase\n- Anaphase");
    expect(b).toMatchObject({ kind: "order", spec: { items: ["Prophase", "Metaphase", "Anaphase"] } });
  });

  it("needs at least three items", () => {
    expect(parseActivity("order", '{"prompt": "x", "items": ["a", "b"]}')).toMatchObject({ kind: "error" });
  });
});

describe("parseActivity: explore", () => {
  it("accepts LaTeX Greek letters as the symbols themselves", () => {
    const a = parseActivity(
      "explore",
      '{"title": "Density", "formula": "\\\\rho = m / V", "inputs": {"m": {"min": 1, "max": 20, "value": 5}, "V": {"min": 1, "max": 10, "value": 2}}, "output": {"unit": "kg/m³"}}',
    );
    expect(a.kind).toBe("explore");
    if (a.kind === "explore") {
      expect(a.spec.output.symbol).toBe("ρ");
      expect(a.spec.evaluate({ m: 10, V: 2 })).toBe(5);
    }
  });

  it("accepts a formula with slider inputs", () => {
    const a = parseActivity(
      "explore",
      '{"title": "Ohm\'s law", "formula": "I = V / R", "inputs": {"V": {"min": 0, "max": 12, "value": 6, "unit": "V"}, "R": {"min": 1, "max": 20, "value": 3, "unit": "Ω"}}, "output": {"unit": "A"}}',
    );
    expect(a.kind).toBe("explore");
    if (a.kind === "explore") {
      expect(a.spec.output.symbol).toBe("I");
      expect(a.spec.evaluate({ V: 6, R: 3 })).toBe(2);
    }
  });

  it("allows Greek symbols such as ρ for density", () => {
    const a = parseActivity("explore", '{"formula": "ρ = m / V", "inputs": {"m": {"min": 1, "max": 100, "value": 50}, "V": {"min": 1, "max": 50, "value": 10}}, "output": {"unit": "g/cm³"}}');
    expect(a.kind).toBe("explore");
    if (a.kind === "explore") expect(a.spec.evaluate({ m: 50, V: 10 })).toBe(5);
  });

  it("rejects a formula that uses a letter with no slider", () => {
    expect(parseActivity("explore", '{"formula": "F = m * a", "inputs": {"m": {"min": 1, "max": 10, "value": 2}}, "output": {}}')).toMatchObject({
      kind: "error",
    });
  });

  it("rejects a formula without an output on the left", () => {
    expect(parseActivity("explore", '{"formula": "m * a", "inputs": {"m": {"min": 1, "max": 10, "value": 2}, "a": {"min": 0, "max": 5, "value": 1}}, "output": {}}')).toMatchObject({
      kind: "error",
    });
  });
});

describe("gaps on the working-out board", () => {
  it("splits a line into maths and gaps", () => {
    expect(parseGaps("(x+2)(x+[[3]]) = 0")).toEqual([{ text: "(x+2)(x+" }, { answers: ["3"] }, { text: ") = 0" }]);
    expect(parseGaps("x = [[-2|−2]]")).toEqual([{ text: "x = " }, { answers: ["-2", "−2"] }]);
  });

  it("marks answers generously but correctly", () => {
    expect(checkGap(" 3 ", ["3"])).toBe(true);
    expect(checkGap("-0.7", ["-0.70"])).toBe(true);
    expect(checkGap("−2", ["-2"])).toBe(true);
    expect(checkGap("J'ai", ["j'ai"])).toBe(true);
    expect(checkGap("4", ["3"])).toBe(false);
    expect(checkGap("", ["3"])).toBe(false);
    expect(checkGap("1/2", ["0.5"])).toBe(true);
  });

  it("hides answers when a line is read aloud", () => {
    expect(stripGaps("(x+2)(x+[[3]]) = 0")).toBe("(x+2)(x+ blank ) = 0");
  });
});

describe("gaps inside fractions and roots", () => {
  it("spots a gap inside braces", () => {
    expect(gapsInsideBraces("x = \\dfrac{-3 \\pm \\sqrt{[[29]]}}{2}")).toBe(true);
    expect(gapsInsideBraces("x = \\dfrac{-5}{[[4]]}")).toBe(true);
  });

  it("leaves top-level gaps and escaped braces alone", () => {
    expect(gapsInsideBraces("(x + 2)(x + [[3]]) = 0")).toBe(false);
    expect(gapsInsideBraces("\\{1, 2\\} = [[A]]")).toBe(false);
    expect(gapsInsideBraces("\\dfrac{1}{2} = [[0.5]]")).toBe(false);
  });

  it("draws numbered boxes in place of the gaps, or the answers once revealed", () => {
    expect(boxGaps("\\sqrt{[[29]]} = [[5.39|5.4]]", 0, false)).toBe("\\sqrt{\\boxed{\\,\\textsf{1}\\,}} = \\boxed{\\,\\textsf{2}\\,}");
    expect(boxGaps("\\sqrt{[[29]]}", 2, false)).toBe("\\sqrt{\\boxed{\\,\\textsf{3}\\,}}");
    expect(boxGaps("\\sqrt{[[29]]}", 0, true)).toBe("\\sqrt{\\boxed{29}}");
  });
});

describe("latestLessonStage", () => {
  it("finds the most recent stage across replies", () => {
    const replies = ['```lesson\n{"stage": "hook"}\n```\nWhy it matters.', "Feedback with no stage block.", '```lesson\n{"stage": "check"}\n```\nQuick check.', "More feedback."];
    expect(latestLessonStage(replies)?.stage.id).toBe("check");
  });

  it("is null when no lesson has started", () => {
    expect(latestLessonStage(["Just a normal reply."])).toBeNull();
  });
});

describe("parseLessonStage", () => {
  it("reads the current lesson stage", () => {
    expect(parseLessonStage('{"stage": "check"}')).toEqual({ index: 2, stage: LESSON_STAGES[2] });
    expect(parseLessonStage("stage: recap")).toEqual({ index: 5, stage: LESSON_STAGES[5] });
  });

  it("ignores unknown stages", () => {
    expect(parseLessonStage('{"stage": "dance"}')).toBeNull();
  });
});

describe("scrambled", () => {
  it("always shows the items out of order, and the same way every time", () => {
    const items = ["a", "b", "c", "d"];
    const once = scrambled(items);
    expect(once).not.toEqual(items);
    expect([...once].sort()).toEqual(items);
    expect(scrambled(items)).toEqual(once);
  });
});
