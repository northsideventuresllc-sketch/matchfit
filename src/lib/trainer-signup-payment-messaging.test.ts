import { describe, expect, it } from "vitest";
import {
  TRAINER_SIGNUP_FLOW_OVERVIEW,
  TRAINER_SIGNUP_PAYMENT_INTRO,
  trainerSignupPaymentHoldExplanation,
} from "@/lib/trainer-signup-payment-messaging";
import { stripeConfigHealth } from "@/lib/stripe-config";

describe("trainer-signup-payment-messaging", () => {
  it("explains onboarding deadline and founding promo on the signup overview", () => {
    expect(TRAINER_SIGNUP_FLOW_OVERVIEW).toMatch(/begin onboarding within 7 days/i);
    expect(TRAINER_SIGNUP_FLOW_OVERVIEW).toMatch(/60 days of Match Fit Premium Pro/i);
    expect(TRAINER_SIGNUP_FLOW_OVERVIEW).toMatch(/choose your account type/i);
    expect(TRAINER_SIGNUP_FLOW_OVERVIEW).toMatch(/upload required documents/i);
    expect(TRAINER_SIGNUP_FLOW_OVERVIEW).toMatch(/cannot sell/i);
  });

  it("explains background check payment on the payment step", () => {
    expect(TRAINER_SIGNUP_PAYMENT_INTRO).toMatch(/background check through Match Fit/i);
    expect(TRAINER_SIGNUP_PAYMENT_INTRO).toMatch(/does not capture charges until/i);
  });

  it("describes founding covered pricing without a trainer background hold", () => {
    const copy = trainerSignupPaymentHoldExplanation("FOUNDING_BG_COVERED");
    expect(copy).toMatch(/covers your Checkr background screening/i);
    expect(copy).toMatch(/platform portion only after certification/i);
    expect(copy).toMatch(/60 days of Match Fit Premium Pro/i);
    expect(copy).toMatch(/cannot sell/i);
    expect(copy).not.toMatch(/charged today/i);
  });
});

describe("stripe-config", () => {
  it("reports unhealthy when keys are absent", () => {
    const prevSecret = process.env.STRIPE_SECRET_KEY;
    const prevPublishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    try {
      expect(stripeConfigHealth().healthy).toBe(false);
    } finally {
      if (prevSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = prevSecret;
      if (prevPublishable === undefined) delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      else process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = prevPublishable;
    }
  });
});
