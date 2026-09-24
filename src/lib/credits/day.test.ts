import { describe, expect, it } from "vitest";
import { londonDay, londonMonthStart, nextLondonMidnight } from "./day";

describe("londonMonthStart", () => {
  it("returns UK midnight on the 1st during BST", () => {
    expect(londonMonthStart(new Date("2026-09-24T12:00:00Z")).toISOString()).toBe("2026-08-31T23:00:00.000Z");
  });

  it("returns UK midnight on the 1st during GMT", () => {
    expect(londonMonthStart(new Date("2026-01-14T12:00:00Z")).toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("londonDay", () => {
  it("uses UK local date, not UTC, during BST", () => {
    // 23:30 UTC on 14 July is 00:30 BST on 15 July
    expect(londonDay(new Date("2026-07-14T23:30:00Z"))).toBe("2026-07-15");
  });

  it("matches UTC date in winter (GMT)", () => {
    expect(londonDay(new Date("2026-01-14T23:30:00Z"))).toBe("2026-01-14");
  });
});

describe("nextLondonMidnight", () => {
  it("returns the next UK midnight during BST", () => {
    expect(nextLondonMidnight(new Date("2026-07-14T12:00:00Z")).toISOString()).toBe(
      "2026-07-14T23:00:00.000Z",
    );
  });

  it("returns the next UK midnight during GMT", () => {
    expect(nextLondonMidnight(new Date("2026-01-14T12:00:00Z")).toISOString()).toBe(
      "2026-01-15T00:00:00.000Z",
    );
  });

  it("handles the day the clocks go forward", () => {
    // Clocks go forward 01:00 GMT on 29 March 2026; midnight after the 29th is 23:00Z
    expect(nextLondonMidnight(new Date("2026-03-29T12:00:00Z")).toISOString()).toBe(
      "2026-03-29T23:00:00.000Z",
    );
  });
});
