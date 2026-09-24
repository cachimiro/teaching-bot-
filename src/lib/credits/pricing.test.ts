import { describe, expect, it } from "vitest";
import {
  claudeCostUsd,
  sttCostUsd,
  ttsCostUsd,
  usdToCredits,
  PLAN,
  SKETCH_MODEL,
} from "./pricing";

describe("claudeCostUsd", () => {
  it("prices each token class at its Sonnet 5 rate", () => {
    const usd = claudeCostUsd({
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
      cache_creation_input_tokens: 1_000_000,
    });
    // $2 input + $10 output + $0.20 cache read + $2.50 cache write
    expect(usd).toBeCloseTo(14.7, 6);
  });

  it("prices sketches at the Opus 5 rate", () => {
    expect(claudeCostUsd({ input_tokens: 1_000_000, output_tokens: 1_000_000 }, SKETCH_MODEL)).toBeCloseTo(30, 6);
  });

  it("refuses to guess the price of an unknown model", () => {
    expect(() => claudeCostUsd({ input_tokens: 1, output_tokens: 1 }, "claude-unknown")).toThrow(/No price/);
  });

  it("treats missing cache fields as zero", () => {
    expect(claudeCostUsd({ input_tokens: 500_000, output_tokens: 0 })).toBeCloseTo(1, 6);
  });

  it("costs about a penny for a typical cached tutoring turn", () => {
    const usd = claudeCostUsd({
      input_tokens: 1_000,
      output_tokens: 500,
      cache_read_input_tokens: 7_000,
      cache_creation_input_tokens: 0,
    });
    expect(usdToCredits(usd)).toBeGreaterThan(0.5);
    expect(usdToCredits(usd)).toBeLessThan(1.2);
  });
});

describe("voice costs", () => {
  it("prices speech-to-text per minute of audio", () => {
    expect(sttCostUsd(60)).toBeCloseTo(0.0043, 8);
    expect(sttCostUsd(15)).toBeCloseTo(0.0043 / 4, 8);
  });

  it("prices text-to-speech per 1,000 characters", () => {
    expect(ttsCostUsd(1000)).toBeCloseTo(0.03, 8);
    expect(ttsCostUsd(700)).toBeCloseTo(0.021, 8);
  });
});

describe("usdToCredits", () => {
  it("converts at 1 credit = 1p using the conservative exchange rate", () => {
    // $1 × 0.80 = £0.80 = 80p = 80 credits
    expect(usdToCredits(1)).toBeCloseTo(80, 6);
  });
});

describe("PLAN", () => {
  it("gives 50 credits a day, 1,500 a month", () => {
    expect(PLAN.dailyCredits).toBe(50);
    expect(PLAN.dailyCredits * 30).toBe(1500);
  });

  it("keeps a top-up pack at or above a 25% margin after VAT and Stripe fees", () => {
    const { pricePence, credits } = PLAN.topupPack;
    const net = pricePence / 1.2; // remove 20% VAT
    const afterStripe = net - (net * 0.015 + 20);
    const costPence = credits; // 1 credit = 1p of provider cost
    expect(afterStripe / costPence).toBeGreaterThanOrEqual(1.25);
  });
});
