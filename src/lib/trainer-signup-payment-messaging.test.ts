import { describe, expect, it } from "vitest";
import {
  TRAINER_SIGNUP_FLOW_OVERVIEW,
  TRAINER_SIGNUP_PAYMENT_INTRO,
  trainerSignupPaymentHoldExplanation,
} from "@/lib/trainer-signup-payment-messaging";
import { stripeConfigHealth } from "@/lib/stripe-config";

describe("trainer-signup-payment-messaging", () => {
  it("explains hold vs charge on the signup overview", () => {
    expect(TRAINER_SIGNUP_FLOW_OVERVIEW).toMatch(/onboarding fee hold/i);
    expect(TRAINER_SIGNUP_FLOW_OVERVIEW).toMatch(/captures the platform portion only/i);
  });

  it("explains pending hold on the payment step", () => {
    expect(TRAINER_SIGNUP_PAYMENT_INTRO).toMatch(/temporary hold/i);
    expect(TRAINER_SIGNUP_PAYMENT_INTRO).toMatch(/does not capture/i);
  });

  it("describes founding covered pricing without a trainer background hold", () => {
    const copy = trainerSignupPaymentHoldExplanation("FOUNDING_BG_COVERED");
    expect(copy).toMatch(/covers your Checkr background screening/i);
    expect(copy).toMatch(/platform portion only after certification/i);
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
