import { describe, expect, it } from "vitest";
import { topicKeyterms } from "./keyterms";
import { billableSeconds } from "./billing";

describe("topicKeyterms", () => {
  it("takes the topic title and the terms from the Key terms section", () => {
    const notes = "## Topic overview\nText.\n\n## Key terms\n\n- **Abiotic**: A non-living factor.\n- **Biotic**: A living factor.\n- **Abiotic**: duplicate";
    expect(topicKeyterms({ title: "Abiotic and Biotic Factors", notes })).toEqual(["Abiotic and Biotic Factors", "Abiotic", "Biotic"]);
  });

  it("caps the list at 20 short terms", () => {
    const notes = "## Key terms\n" + Array.from({ length: 40 }, (_, i) => `- **Term ${i}**: x`).join("\n");
    const terms = topicKeyterms({ title: "T", notes });
    expect(terms).toHaveLength(20);
  });

  it("copes with topics that have no key terms", () => {
    expect(topicKeyterms({ title: "Osmosis", notes: "## Overview\nNo list." })).toEqual(["Osmosis"]);
  });
});

describe("billableSeconds", () => {
  const start = new Date("2026-09-24T10:00:00Z");

  it("uses the reported mic time when it is plausible", () => {
    expect(billableSeconds(12.5, start, new Date("2026-09-24T10:00:20Z"))).toBe(12.5);
  });

  it("never bills more than the time the session was actually open (+2s grace)", () => {
    expect(billableSeconds(500, start, new Date("2026-09-24T10:00:20Z"))).toBe(22);
  });

  it("bills the server-timed duration when the client reports nothing, capped at 2 minutes", () => {
    expect(billableSeconds(null, start, new Date("2026-09-24T10:00:30Z"))).toBe(30);
    expect(billableSeconds(null, start, new Date("2026-09-24T11:00:00Z"))).toBe(120);
  });

  it("never bills less than a short-reporting client's server-side minimum of 0", () => {
    expect(billableSeconds(-5, start, new Date("2026-09-24T10:00:10Z"))).toBe(0);
  });
});
