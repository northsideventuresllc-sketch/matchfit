import { describe, expect, it } from "vitest";
import {
  TRAINER_SIGNUP_FLOW_OVERVIEW,
  TRAINER_SIGNUP_PAYMENT_INTRO,
  trainerSignupPaymentHoldExplanation,
} from "@/lib/trainer-signup-payment-messaging";
import { stripeConfigHealth } from "@/lib/stripe-config";

describe("trainer-signup-payment-messaging", () => {
  it("explains hold vs charge on the signup overview", () => {
    expect(TRAINER_SIGNUP_FLOW_OVERVIEW).toMatch(/temporary card hold/i);
    expect(TRAINER_SIGNUP_FLOW_OVERVIEW).toMatch(/only charges/i);
  });

  it("explains pending hold on the payment step", () => {
    expect(TRAINER_SIGNUP_PAYMENT_INTRO).toMatch(/temporary hold/i);
    expect(TRAINER_SIGNUP_PAYMENT_INTRO).toMatch(/does not capture/i);
  });

  it("describes founding escrow split without implying immediate charge", () => {
    const copy = trainerSignupPaymentHoldExplanation("FOUNDING_BG_SURCHARGE_20PCT");
    expect(copy).toMatch(/hold includes/i);
    expect(copy).toMatch(/screening portion/i);
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
