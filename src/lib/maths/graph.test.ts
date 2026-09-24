import { describe, expect, it } from "vitest";
import { analyseGraph, parseGraphSpec, niceTicks } from "./graph";

const xs = (marks: { x: number; kind: string }[], kind: string) =>
  marks.filter((m) => m.kind === kind).map((m) => Math.round(m.x * 1000) / 1000);

describe("parseGraphSpec", () => {
  it("accepts a simple spec with plain function strings", () => {
    const spec = parseGraphSpec('{"functions": ["x^2 + 5x + 6"], "x": [-6, 1], "mark": ["roots", "vertex"]}');
    expect(spec.functions).toMatchObject([{ expr: "x^2 + 5x + 6" }]);
    expect(spec.x).toEqual([-6, 1]);
  });

  it("accepts sliders via params", () => {
    const spec = parseGraphSpec('{"functions": [{"expr": "ax^2 + bx + c", "label": "y = ax^2 + bx + c"}], "params": {"a": 1, "b": 5, "c": 6}}');
    expect(spec.params).toEqual({ a: 1, b: 5, c: 6 });
  });

  it("rejects bad input with a readable error", () => {
    expect(() => parseGraphSpec("not json")).toThrow();
    expect(() => parseGraphSpec('{"functions": ["x^2 + k"]}')).toThrow(/Unknown name "k"/);
    expect(() => parseGraphSpec('{"functions": ["x", "x", "x", "x"]}')).toThrow();
    expect(() => parseGraphSpec('{"x": [5, 1], "functions": ["x"]}')).toThrow(/range/);
    expect(() => parseGraphSpec("{}")).toThrow(/nothing to plot/);
  });
});

describe("analyseGraph", () => {
  it("finds the roots, turning point and y-intercept of a quadratic", () => {
    const g = analyseGraph(parseGraphSpec('{"functions": ["x^2 + 5x + 6"], "x": [-6, 1], "mark": ["roots", "vertex", "y-intercept"]}'));
    expect(xs(g.marks, "root")).toEqual([-3, -2]);
    const vertex = g.marks.find((m) => m.kind === "vertex")!;
    expect(vertex.x).toBeCloseTo(-2.5, 3);
    expect(vertex.y).toBeCloseTo(-0.25, 3);
    expect(g.marks.find((m) => m.kind === "y-intercept")).toMatchObject({ x: 0, y: 6 });
  });

  it("reports no roots when the curve never meets the x-axis", () => {
    const g = analyseGraph(parseGraphSpec('{"functions": ["x^2 + 1"], "x": [-3, 3], "mark": ["roots"]}'));
    expect(xs(g.marks, "root")).toEqual([]);
  });

  it("catches a curve that only touches the x-axis (repeated root)", () => {
    const g = analyseGraph(parseGraphSpec('{"functions": ["(x - 2)^2"], "x": [-1, 5], "mark": ["roots"]}'));
    expect(xs(g.marks, "root")).toEqual([2]);
  });

  it("finds where two graphs cross", () => {
    const g = analyseGraph(parseGraphSpec('{"functions": ["x^2", "2x + 1"], "x": [-3, 4], "mark": ["intersections"]}'));
    expect(xs(g.marks, "intersection")).toEqual([
      Math.round((1 - Math.SQRT2) * 1000) / 1000,
      Math.round((1 + Math.SQRT2) * 1000) / 1000,
    ]);
  });

  it("recomputes with new slider values", () => {
    const spec = parseGraphSpec('{"functions": ["ax^2 + bx + c"], "params": {"a": 1, "b": 5, "c": 6}, "x": [-6, 6], "mark": ["roots"]}');
    expect(xs(analyseGraph(spec, { a: 1, b: 0, c: -4 }).marks, "root")).toEqual([-2, 2]);
  });

  it("plots science data and sizes the axes to fit it", () => {
    const g = analyseGraph(
      parseGraphSpec('{"data": [{"points": [[0, 0], [4, 12], [10, 12]], "label": "car"}], "xLabel": "Time (s)", "yLabel": "Velocity (m/s)"}'),
    );
    expect(g.x[0]).toBeLessThanOrEqual(0);
    expect(g.x[1]).toBeGreaterThanOrEqual(10);
    expect(g.y[1]).toBeGreaterThanOrEqual(12);
    expect(g.series).toHaveLength(1);
  });

  it("chooses a y-range that shows the marked points with some padding", () => {
    const g = analyseGraph(parseGraphSpec('{"functions": ["x^2 + 5x + 6"], "x": [-6, 1], "mark": ["vertex"]}'));
    expect(g.y[0]).toBeLessThan(-0.25);
    expect(g.y[1]).toBeGreaterThan(12);
  });
});

describe("statistics graphs", () => {
  it("draws a bar chart with category labels, starting the y-axis at zero", () => {
    const spec = parseGraphSpec(
      '{"categories": ["Cat", "Dog", "Fish"], "data": [{"points": [[0, 4], [1, 7], [2, 2]], "style": "bars"}], "yLabel": "Frequency"}',
    );
    const g = analyseGraph(spec);
    expect(g.series[0].style).toBe("bars");
    expect(g.x[0]).toBeLessThanOrEqual(-0.5);
    expect(g.x[1]).toBeGreaterThanOrEqual(2.5);
    expect(g.y[0]).toBe(0);
    expect(g.categories).toEqual(["Cat", "Dog", "Fish"]);
  });

  it("draws a scatter graph as points with an optional line of best fit", () => {
    const spec = parseGraphSpec('{"data": [{"points": [[1, 2], [2, 4.1], [3, 5.9]], "style": "points"}], "functions": ["2x"], "x": [0, 4]}');
    const g = analyseGraph(spec);
    expect(g.series[0].style).toBe("points");
    expect(g.curves).toHaveLength(1);
  });
});

describe("niceTicks", () => {
  it("picks round tick values", () => {
    expect(niceTicks(-6, 1)).toEqual([-6, -5, -4, -3, -2, -1, 0, 1]);
    expect(niceTicks(0, 100)).toEqual([0, 20, 40, 60, 80, 100]);
  });
});
