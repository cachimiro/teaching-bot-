import { describe, expect, it } from "vitest";
import { fenceBareDiagrams, numberStepsBlocks } from "./diagrams";

describe("numberStepsBlocks", () => {
  it("tags each working-out board with its position so voice can highlight the right one", () => {
    const md = "Intro\n```steps\nx = 1 | a\n```\n```graph\n{}\n```\n```steps\nx = 2 | b\n```";
    expect(numberStepsBlocks(md)).toBe("Intro\n```steps-0\nx = 1 | a\n```\n```graph\n{}\n```\n```steps-1\nx = 2 | b\n```");
  });
});

describe("fenceBareDiagrams", () => {
  it("wraps a mermaid diagram the model forgot to fence", () => {
    const input = 'The curve:\n\nxychart-beta\n  title "y = x^2"\n  x-axis [-1, 0, 1]\n  line [1, 0, 1]\n\nNotice the shape.';
    expect(fenceBareDiagrams(input)).toBe(
      'The curve:\n\n```mermaid\nxychart-beta\n  title "y = x^2"\n  x-axis [-1, 0, 1]\n  line [1, 0, 1]\n```\n\nNotice the shape.',
    );
  });

  it("wraps bare flowcharts and pie charts", () => {
    expect(fenceBareDiagrams('flowchart LR\n  A["a"] --> B["b"]')).toBe('```mermaid\nflowchart LR\n  A["a"] --> B["b"]\n```');
    expect(fenceBareDiagrams('pie title "Pets"\n  "Dogs" : 3')).toBe('```mermaid\npie title "Pets"\n  "Dogs" : 3\n```');
  });

  it("leaves fenced diagrams and ordinary prose alone", () => {
    const fenced = '```mermaid\nflowchart LR\n  A --> B\n```';
    expect(fenceBareDiagrams(fenced)).toBe(fenced);
    expect(fenceBareDiagrams("A flowchart LR diagram shows order.")).toBe("A flowchart LR diagram shows order.");
  });
});
