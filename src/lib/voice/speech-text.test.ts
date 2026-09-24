import { describe, expect, it } from "vitest";
import { toSpeech, MAX_TTS_CHARS } from "./speech-text";

describe("toSpeech", () => {
  it("strips markdown emphasis, headings, list markers and links", () => {
    expect(toSpeech("## Key idea\n- **Abiotic** means _non-living_\n- See [Diffusion](/learn/biology/x)")).toBe(
      "Key idea. Abiotic means non-living. See Diffusion.",
    );
  });

  it("reads common maths notation in words", () => {
    expect(toSpeech("So $x^2 + 3x = 10$ and $a^3$")).toBe("So x squared plus 3x equals 10 and a cubed.");
    expect(toSpeech("$\\frac{a}{b} \\times 2$")).toBe("a over b times 2.");
    expect(toSpeech("$\\sqrt{16} = 4$")).toBe("the square root of 16 equals 4.");
  });

  it("says signs and fractions in words", () => {
    expect(toSpeech("$x = \\dfrac{-5 \\pm 1}{2}$")).toBe("x equals minus 5 plus or minus 1 over 2.");
    expect(toSpeech("$-2 + \\sqrt3$ and $2\\sqrt{12}$")).toBe("minus 2 plus the square root of 3 and 2 the square root of 12.");
  });

  it("replaces display maths with a pointer to the screen", () => {
    expect(toSpeech("Here it is:\n$$y = mx + c$$\nNeat.")).toBe("Here it is: (see the working on screen) Neat.");
  });

  it("points to diagrams instead of reading their code", () => {
    expect(toSpeech('Look at this.\n```mermaid\nflowchart LR\n  A["x"] --> B["y"]\n```\nWhat happens next?')).toBe(
      "Look at this. (have a look at the diagram) What happens next?",
    );
  });

  it("caps length at a sentence boundary", () => {
    const long = "This is a sentence. ".repeat(200);
    const out = toSpeech(long);
    expect(out.length).toBeLessThanOrEqual(MAX_TTS_CHARS);
    expect(out.endsWith(".")).toBe(true);
  });
});
