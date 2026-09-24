import { describe, expect, it } from "vitest";
import { extractSvg, isSafeSvg, layoutLabels, sketchKey, sketchRequest, wrapLabel } from "./sketch";

describe("wrapLabel", () => {
  it("keeps short labels on one line", () => {
    expect(wrapLabel("Nucleus")).toEqual(["Nucleus"]);
  });

  it("wraps long labels on word boundaries", () => {
    expect(wrapLabel("Pure water (distillate)")).toEqual(["Pure water", "(distillate)"]);
    expect(wrapLabel("Round-bottomed flask")).toEqual(["Round-bottomed", "flask"]);
  });
});

describe("layoutLabels", () => {
  const drawing = (labels: string) => `<svg viewBox="0 0 620 410"><rect width="620" height="410" fill="#ffffff"/><circle cx="300" cy="200" r="50"/>${labels}</svg>`;
  const texts = (svg: string) => [...svg.matchAll(/<text x="(\d+)" y="([\d.]+)"[^>]*>([^<]*)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]), text: m[3] }));

  it("replaces label markers with text, a leader line and a dot at the part", () => {
    const svg = layoutLabels(drawing('<label x="280" y="190" side="left">Nucleus</label>'));
    expect(svg).not.toContain("<label");
    expect(texts(svg)).toEqual([{ x: 160, y: expect.any(Number), text: "Nucleus" }]);
    expect(svg).toMatch(/<line [^>]*x2="280" y2="190"/);
    expect(svg).toMatch(/<circle cx="280" cy="190" r="2.5"/);
  });

  it("puts labels on the side they name, or the nearer side when none is given", () => {
    const svg = layoutLabels(drawing('<label x="400" y="100">Axon</label><label x="200" y="100">Dendrite</label><label x="400" y="300" side="left">Cell body</label>'));
    const byText = Object.fromEntries(texts(svg).map((t) => [t.text, t.x]));
    expect(byText).toEqual({ Axon: 460, Dendrite: 160, "Cell body": 160 });
  });

  it("spaces crowded labels so they never overlap, keeping their top-to-bottom order", () => {
    const svg = layoutLabels(
      drawing('<label x="440" y="300">Beaker</label><label x="440" y="296">Pure water (distillate)</label><label x="440" y="305">Water in</label>'),
    );
    const placed = texts(svg)
      .filter((t) => t.x === 460)
      .sort((a, b) => a.y - b.y);
    expect(placed.map((t) => t.text)).toEqual(["Pure water", "Beaker", "Water in"]);
    const [first, second, third] = placed;
    expect(second.y - first.y).toBeGreaterThanOrEqual(17 + 30);
    expect(third.y - second.y).toBeGreaterThanOrEqual(30);
  });

  it("keeps labels inside the canvas", () => {
    const many = Array.from({ length: 10 }, (_, i) => `<label x="440" y="${395 + i}">Part ${i}</label>`).join("");
    const ys = texts(layoutLabels(drawing(many))).map((t) => t.y);
    expect(Math.max(...ys)).toBeLessThanOrEqual(400);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(15);
  });

  it("escapes label text and drops any tags inside it", () => {
    const svg = layoutLabels(drawing('<label x="300" y="200">Salt &amp; water <b>here</b></label><label x="300" y="300">x &lt; 5</label>'));
    expect(svg).toContain(">Salt &amp; water here<");
    expect(svg).toContain(">x &lt; 5<");
    expect(svg).not.toContain("<b>");
  });

  it("leaves a drawing without markers unchanged", () => {
    expect(layoutLabels(drawing(""))).toBe(drawing(""));
  });
});

describe("sketchKey", () => {
  const spec = (title: string, labels: string[], detail = "") => ({ title, labels, detail });

  it("gives the same drawing the same key however the tutor phrases it", () => {
    expect(sketchKey(spec("Motor neurone", ["Axon", "Cell body"], "impulse arrow"))).toBe(sketchKey(spec("The motor neurone", ["cell body", "axon"])));
  });

  it("gives different drawings different keys", () => {
    expect(sketchKey(spec("Motor neurone", ["Axon"]))).not.toBe(sketchKey(spec("Reflex arc", ["Axon"])));
  });

  it("is a sha-256 hex digest", () => {
    expect(sketchKey(spec("Eye", ["Lens"]))).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("sketchRequest", () => {
  it("asks for exactly the named parts", () => {
    expect(sketchRequest({ title: "The human eye", labels: ["Cornea", "Lens"], detail: "side view" })).toBe(
      "Title: The human eye\nMark exactly these parts, with exactly these names: Cornea; Lens\nDetails: side view",
    );
  });
});

describe("extractSvg", () => {
  it("pulls the SVG out of a reply", () => {
    expect(extractSvg('Here you go:\n<svg viewBox="0 0 10 10"><circle r="1"/></svg>\nDone')).toBe('<svg viewBox="0 0 10 10"><circle r="1"/></svg>');
  });

  it("returns null when there is no SVG", () => {
    expect(extractSvg("Sorry, I can't draw that.")).toBeNull();
  });
});

describe("isSafeSvg", () => {
  const ok = '<svg viewBox="0 0 620 410"><rect width="10" height="10" fill="#fff"/><text x="1" y="1">Axon</text></svg>';

  it("accepts a plain diagram", () => {
    expect(isSafeSvg(ok)).toBe(true);
  });

  it("rejects scripts, event handlers, external links and embedded HTML", () => {
    expect(isSafeSvg('<svg><script>alert(1)</script></svg>')).toBe(false);
    expect(isSafeSvg('<svg><rect onclick="x()"/></svg>')).toBe(false);
    expect(isSafeSvg('<svg><a href="javascript:alert(1)"><text>x</text></a></svg>')).toBe(false);
    expect(isSafeSvg('<svg><image href="https://evil.example/x.png"/></svg>')).toBe(false);
    expect(isSafeSvg('<svg><foreignObject><div>x</div></foreignObject></svg>')).toBe(false);
  });

  it("rejects drawings that are too big", () => {
    expect(isSafeSvg(`<svg>${"<rect/>".repeat(20000)}</svg>`)).toBe(false);
  });
});
