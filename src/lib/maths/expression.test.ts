import { describe, expect, it } from "vitest";
import { compile } from "./expression";

const at = (expr: string, vars: Record<string, number> = {}) => compile(expr, Object.keys(vars).filter((v) => v !== "x"))(vars);

describe("compile", () => {
  it("handles the usual operators with correct precedence", () => {
    expect(at("1 + 2 * 3")).toBe(7);
    expect(at("(1 + 2) * 3")).toBe(9);
    expect(at("2^3^2")).toBe(512); // right-associative
    expect(at("10 / 4")).toBe(2.5);
  });

  it("treats unary minus like a maths student would: -x^2 is -(x^2)", () => {
    expect(at("-x^2", { x: 3 })).toBe(-9);
    expect(at("(-x)^2", { x: 3 })).toBe(9);
    expect(at("2 - -3")).toBe(5);
  });

  it("understands implicit multiplication", () => {
    expect(at("5x", { x: 2 })).toBe(10);
    expect(at("2(x+1)", { x: 2 })).toBe(6);
    expect(at("(x+1)(x-1)", { x: 3 })).toBe(8);
    expect(at("x(x+2)", { x: 3 })).toBe(15);
    expect(at("ax^2 + bx + c", { x: 2, a: 1, b: 5, c: 6 })).toBe(20);
    expect(at("2pi")).toBeCloseTo(2 * Math.PI);
  });

  it("accepts the symbols people actually type", () => {
    expect(at("x² + 3x − 4", { x: 2 })).toBe(6);
    expect(at("2 × 3 ÷ 4")).toBe(1.5);
    expect(at("√16 + x³", { x: 2 })).toBe(12);
  });

  it("supports common functions and constants", () => {
    expect(at("sqrt(9) + abs(-2)")).toBe(5);
    expect(at("sin(0) + cos(0)")).toBe(1);
    expect(at("ln(e)")).toBeCloseTo(1);
    expect(at("log(100)")).toBeCloseTo(2);
  });

  it("allows Greek letters as variables (ρ, λ, θ)", () => {
    expect(at("ρ * 2", { ρ: 3 })).toBe(6);
    expect(at("fλ", { f: 50, λ: 2 })).toBe(100);
  });

  it("rejects anything that isn't maths", () => {
    expect(() => compile("alert(1)", [])).toThrow();
    expect(() => compile("x +", [])).toThrow();
    expect(() => compile("y + 1", [])).toThrow(/Unknown name "y"/);
    expect(() => compile("constructor", [])).toThrow();
    expect(() => compile("1".repeat(300), [])).toThrow(/too long/);
  });
});
