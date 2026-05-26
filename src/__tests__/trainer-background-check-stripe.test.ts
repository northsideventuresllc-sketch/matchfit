import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  TRAINER_BACKGROUND_CHECK_STRIPE_PURPOSE,
  isTrainerBackgroundCheckPaymentIntent,
  trainerBackgroundCheckAmountCents,
} from "@/lib/trainer-background-check-stripe";
import {
  getStripePublishableKey,
  isStripePublishableConfigured,
  requireStripePublishableKey,
} from "@/lib/stripe-publishable";
import type Stripe from "stripe";

describe("stripe-publishable", () => {
  const prev = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = prev;
  });

  it("throws when publishable key is missing", () => {
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    expect(() => requireStripePublishableKey()).toThrow(/NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY/);
    expect(getStripePublishableKey()).toBeNull();
    expect(isStripePublishableConfigured()).toBe(false);
  });

  it("returns trimmed publishable key", () => {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = " pk_test_abc ";
    expect(requireStripePublishableKey()).toBe("pk_test_abc");
    expect(isStripePublishableConfigured()).toBe(true);
  });
});

describe("trainer-background-check-stripe", () => {
  const prevUsd = process.env.NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD;
  const prevCheckr = process.env.MATCH_FIT_CHECKR_DEFAULT_BG_FEE_CENTS;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD;
    delete process.env.MATCH_FIT_CHECKR_DEFAULT_BG_FEE_CENTS;
  });

  afterEach(() => {
    if (prevUsd === undefined) delete process.env.NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD;
    else process.env.NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD = prevUsd;
    if (prevCheckr === undefined) delete process.env.MATCH_FIT_CHECKR_DEFAULT_BG_FEE_CENTS;
    else process.env.MATCH_FIT_CHECKR_DEFAULT_BG_FEE_CENTS = prevCheckr;
  });

  it("uses public USD env for amount when set", () => {
    process.env.NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD = "49.99";
    expect(trainerBackgroundCheckAmountCents()).toBe(4999);
  });

  it("defaults to Checkr mock cents when USD unset", () => {
    expect(trainerBackgroundCheckAmountCents()).toBe(4900);
  });

  it("recognizes background check payment intent metadata", () => {
    const pi = {
      metadata: { purpose: TRAINER_BACKGROUND_CHECK_STRIPE_PURPOSE, trainerId: "t1" },
    } as Stripe.PaymentIntent;
    expect(isTrainerBackgroundCheckPaymentIntent(pi)).toBe(true);
    expect(
      isTrainerBackgroundCheckPaymentIntent({
        metadata: { purpose: "other" },
      } as Stripe.PaymentIntent),
    ).toBe(false);
  });
});
