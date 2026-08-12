import { describe, expect, it } from "vitest";
import { computePayoutFeeCents, MIN_PAYOUT_CENTS, validatePayoutAmountCents } from "@/lib/trainer-payouts";

describe("computePayoutFeeCents", () => {
  it("charges the $1.99 instant fee only for INSTANT", () => {
    expect(computePayoutFeeCents("INSTANT")).toBe(199);
    expect(computePayoutFeeCents("STANDARD")).toBe(0);
  });
});

describe("validatePayoutAmountCents", () => {
  it("rejects a non-positive amount", () => {
    expect(validatePayoutAmountCents(0, 10_000)).toMatch(/enter an amount/i);
    expect(validatePayoutAmountCents(-100, 10_000)).toMatch(/enter an amount/i);
  });

  it("enforces the $5 minimum", () => {
    expect(validatePayoutAmountCents(499, 10_000)).toMatch(/minimum/i);
    expect(validatePayoutAmountCents(MIN_PAYOUT_CENTS, 10_000)).toBeNull();
  });

  it("rejects an amount above the available balance", () => {
    expect(validatePayoutAmountCents(10_001, 10_000)).toMatch(/more than your available balance/i);
    expect(validatePayoutAmountCents(10_000, 10_000)).toBeNull();
  });
});
