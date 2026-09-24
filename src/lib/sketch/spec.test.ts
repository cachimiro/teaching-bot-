import { describe, expect, it } from "vitest";
import { canonicalSketch, parseSketchJson, parseSketchSpec } from "./spec";

describe("parseSketchSpec", () => {
  it("reads a title, labels and optional detail", () => {
    expect(parseSketchSpec({ title: " The  human eye ", labels: ["Cornea", " Lens "], detail: "side view" })).toEqual({
      title: "The human eye",
      labels: ["Cornea", "Lens"],
      detail: "side view",
    });
  });

  it("drops repeated labels", () => {
    expect(parseSketchSpec({ title: "Eye", labels: ["Lens", "lens", "Retina"] })?.labels).toEqual(["Lens", "Retina"]);
  });

  it("accepts an older describe field as the detail", () => {
    expect(parseSketchSpec({ title: "Reflex arc", describe: "receptor to effector" })?.detail).toBe("receptor to effector");
  });

  it("needs something to draw", () => {
    expect(parseSketchSpec({ title: "Eye" })).toBeNull();
    expect(parseSketchSpec({ labels: ["Lens"] })).toBeNull();
    expect(parseSketchSpec("eye")).toBeNull();
  });

  it("refuses oversized requests", () => {
    expect(parseSketchSpec({ title: "Eye", labels: Array.from({ length: 15 }, (_, i) => `Part ${i}`) })).toBeNull();
    expect(parseSketchSpec({ title: "Eye", detail: "x".repeat(401) })).toBeNull();
  });

  it("returns null for broken JSON", () => {
    expect(parseSketchJson('{"title": "Eye", "labels": ["Le')).toBeNull();
  });
});

describe("canonicalSketch", () => {
  const eye = (title: string, labels: string[], detail = "") => canonicalSketch({ title, labels, detail });

  it("treats the same subject and parts as the same drawing", () => {
    expect(eye("The human eye", ["Cornea", "Lens", "Retina"], "side view")).toBe(eye("Labelled diagram of the human eye", ["retina", "cornea", "lens"]));
  });

  it("treats different parts as a different drawing", () => {
    expect(eye("The human eye", ["Cornea", "Lens"])).not.toBe(eye("The human eye", ["Cornea", "Lens", "Retina"]));
  });

  it("uses the detail when there are no labels", () => {
    expect(eye("Reflex arc", [], "Receptor to effector")).not.toBe(eye("Reflex arc", [], "Hand on a hot plate"));
  });
});
