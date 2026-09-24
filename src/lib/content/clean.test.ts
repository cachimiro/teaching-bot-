import { describe, expect, it } from "vitest";
import { cleanPdfText } from "./clean";

describe("cleanPdfText", () => {
  it("removes NUL and other control characters Postgres can't store, keeping newlines", () => {
    expect(cleanPdfText("a\u0000b\u0007c\nd\te")).toBe("abc\nd\te");
  });

  it("collapses answer-line dot leaders", () => {
    expect(cleanPdfText("Answer . . . . . . . . cm")).toBe("Answer ____ cm");
  });
});
