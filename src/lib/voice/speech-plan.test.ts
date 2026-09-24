import { describe, expect, it } from "vitest";
import { looksLikeMaths, parseSteps, speechPlan } from "./speech-plan";

const STEPS = "```steps\nx^2 + 5x + 6 = 0 | Here's our equation.\na = 1,\\ b = 5,\\ c = 6 | First, read off $a$, $b$ and $c$.\nx = -2 \\text{ or } x = -3\n```";

describe("parseSteps", () => {
  it("splits each line into maths and the note the tutor says about it", () => {
    expect(parseSteps("x^2 = 4 | Start here.\n$x = \\pm 2$ | Square root both sides.\n\nx = 2")).toEqual([
      { math: "x^2 = 4", note: "Start here." },
      { math: "x = \\pm 2", note: "Square root both sides." },
      { math: "x = 2", note: "" },
    ]);
  });

  it("keeps absolute-value bars in the maths (only ' | ' separates the note)", () => {
    expect(parseSteps("|x - 2| = 3 | Two cases.")).toEqual([{ math: "|x - 2| = 3", note: "Two cases." }]);
  });
});

describe("looksLikeMaths", () => {
  it("recognises equations and working as maths", () => {
    for (const s of ["x^2 + 5x + 6 = 0", "a = 1,\\ b = 5,\\ c = 6", "x = -2 \\text{ or } x = -3", "p = 6 \\div 2 = 3", "\\sqrt{12} = 2\\sqrt{3}", "v = u + at"]) {
      expect(looksLikeMaths(s), s).toBe(true);
    }
  });

  it("treats words and French as plain text", () => {
    for (const s of ["j'ai + mangé", "tu as fini", "speed = distance / time", "nous avons regardé"]) {
      expect(looksLikeMaths(s), s).toBe(false);
    }
  });
});

describe("speechPlan", () => {
  it("speaks the prose, then each step's note tagged with its step", () => {
    const plan = speechPlan(`Let's solve it with the formula.\n\n${STEPS}\n\nWhat do you get if c is 9?`, true);
    expect(plan).toEqual([
      { text: "Let's solve it with the formula." },
      { text: "Here's our equation.", step: { block: 0, index: 0 } },
      { text: "First, read off a, b and c.", step: { block: 0, index: 1 } },
      { text: "x equals minus 2 or x equals minus 3.", step: { block: 0, index: 2 } },
      { text: "What do you get if c is 9?" },
    ]);
  });

  it("only returns finished pieces while the reply is still streaming", () => {
    const partial = "Let's solve it with the formula.\n\n```steps\nx^2 + 5x + 6 = 0 | Here's our equation.\na = 1 | First, re";
    expect(speechPlan(partial, false)).toEqual([
      { text: "Let's solve it with the formula." },
      { text: "Here's our equation.", step: { block: 0, index: 0 } },
    ]);
  });

  it("is stable: a longer version of the same reply starts with the same segments", () => {
    const full = `Let's solve it with the formula. It always works.\n\n${STEPS}\n\nNow try one yourself. What is b here?`;
    const final = speechPlan(full, true);
    for (let n = 0; n <= full.length; n += 7) {
      const partial = speechPlan(full.slice(0, n), false);
      expect(final.slice(0, partial.length)).toEqual(partial);
    }
  });

  it("says nothing for graphs and diagrams, and numbers steps blocks separately", () => {
    const md = `Here's the graph.\n\`\`\`graph\n{"functions": ["x^2"]}\n\`\`\`\n${STEPS}\n\`\`\`steps\nx = 1 | Second board.\n\`\`\``;
    const plan = speechPlan(md, true);
    expect(plan.map((s) => s.text)).not.toContain(expect.stringContaining("functions"));
    expect(plan.at(-1)).toEqual({ text: "Second board.", step: { block: 1, index: 0 } });
  });

  it("never reads out the answer to a gap on the board", () => {
    const plan = speechPlan("```steps\nx^2+5x+6 = (x+2)(x+[[3]]) | Factorise.\nx = [[-3]]\n```", true);
    expect(plan.map((s) => s.text).join(" ")).not.toMatch(/3/);
  });

  it("starts with a short first piece so speech begins quickly", () => {
    const plan = speechPlan("Right. Here is a much longer sentence that keeps going for a while. And another one here.", true);
    expect(plan[0].text).toBe("Right.");
  });
});
