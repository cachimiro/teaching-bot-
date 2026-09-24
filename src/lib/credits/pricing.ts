/**
 * Provider prices and plan constants. 1 credit = 1p of real provider cost.
 *
 * Sources (checked 2026-09-24):
 *  - Claude Sonnet 5: $2 / $10 per MTok; cache reads 10% of input; 5-minute cache writes 125% of input.
 *  - Claude Opus 5 (tutor sketches only): $5 / $25 per MTok, same cache multipliers.
 *  - Deepgram Nova-3 pre-recorded (monolingual): $0.0043/min. Aura-2 TTS: $0.030 per 1k characters.
 */

export const MODEL = "claude-sonnet-5";
/** Draws tutor sketches: slower and dearer, but each drawing is made once and reused by everyone. */
export const SKETCH_MODEL = "claude-opus-5";

const PER_MTOK: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  [MODEL]: { input: 2.0, output: 10.0, cacheRead: 0.2, cacheWrite: 2.5 },
  [SKETCH_MODEL]: { input: 5.0, output: 25.0, cacheRead: 0.5, cacheWrite: 6.25 },
};

const DEEPGRAM = {
  sttPerMinute: 0.0043,
  ttsPer1kChars: 0.03,
};

/** Deliberately pessimistic so a weaker pound never eats the margin. */
export const USD_TO_GBP = Number(process.env.USD_TO_GBP ?? 0.8);

export const PLAN = {
  /** 1,500 credits/month released as a daily allowance that resets at midnight Europe/London. */
  dailyCredits: 50,
  /** £5 → 300 credits keeps ≥ 25% margin after 20% VAT and Stripe's 1.5% + 20p. */
  topupPack: { pricePence: 500, credits: 300 },
  /** Default parent cap on auto top-ups per calendar month. */
  defaultMonthlyTopupCapPence: 2000,
};

export type ClaudeUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

export function claudeCostUsd(u: ClaudeUsage, model: string = MODEL): number {
  const price = PER_MTOK[model];
  if (!price) throw new Error(`No price for ${model}`);
  return (
    (u.input_tokens * price.input +
      u.output_tokens * price.output +
      (u.cache_read_input_tokens ?? 0) * price.cacheRead +
      (u.cache_creation_input_tokens ?? 0) * price.cacheWrite) /
    1_000_000
  );
}

export function sttCostUsd(seconds: number): number {
  return (seconds / 60) * DEEPGRAM.sttPerMinute;
}

export function ttsCostUsd(chars: number): number {
  return (chars / 1000) * DEEPGRAM.ttsPer1kChars;
}

export function usdToCredits(usd: number): number {
  return usd * USD_TO_GBP * 100;
}
