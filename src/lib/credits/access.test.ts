import { describe, expect, it } from "vitest";
import { decideAccess, type CreditStatus } from "./access";

const base: CreditStatus = {
  dailyUsed: 0,
  walletBalance: 0,
  autoTopup: false,
  monthlyCapPence: 2000,
  autoSpentPence: 0,
  subscriptionStatus: "active",
};

describe("decideAccess", () => {
  it("allows a student with allowance left today", () => {
    expect(decideAccess({ ...base, dailyUsed: 20 })).toEqual({
      ok: true,
      dailyRemaining: 30,
      walletBalance: 0,
      autoTopupPacks: 0,
    });
  });

  it("allows a student who has used today's allowance but has top-up credits", () => {
    expect(decideAccess({ ...base, dailyUsed: 50, walletBalance: 40 })).toMatchObject({ ok: true, autoTopupPacks: 0 });
  });

  it("blocks with daily_limit when out of credits and auto top-up is off", () => {
    expect(decideAccess({ ...base, dailyUsed: 50 })).toEqual({ ok: false, reason: "daily_limit" });
  });

  it("treats less than one credit left as empty", () => {
    expect(decideAccess({ ...base, dailyUsed: 49.5 })).toEqual({ ok: false, reason: "daily_limit" });
  });

  it("asks for one auto top-up pack when out of credits and under the cap", () => {
    expect(decideAccess({ ...base, dailyUsed: 50, walletBalance: -2.4, autoTopup: true })).toMatchObject({
      ok: true,
      autoTopupPacks: 1,
    });
  });

  it("blocks with topup_cap_reached when another pack would exceed the parent cap", () => {
    expect(
      decideAccess({ ...base, dailyUsed: 50, autoTopup: true, autoSpentPence: 1600, monthlyCapPence: 2000 }),
    ).toEqual({ ok: false, reason: "topup_cap_reached" });
  });

  it("allows a pack that lands exactly on the cap", () => {
    expect(
      decideAccess({ ...base, dailyUsed: 50, autoTopup: true, autoSpentPence: 1500, monthlyCapPence: 2000 }),
    ).toMatchObject({ ok: true, autoTopupPacks: 1 });
  });

  it("blocks everyone without an active subscription", () => {
    expect(decideAccess({ ...base, subscriptionStatus: "inactive" })).toEqual({ ok: false, reason: "no_subscription" });
  });
});
