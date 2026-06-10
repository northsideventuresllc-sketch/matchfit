import { describe, expect, it } from "vitest";
import {
  TRAINER_SIGNUP_AGREEMENT_BILLING_DOCUMENT,
  TRAINER_SIGNUP_FLOW_OVERVIEW,
  TRAINER_SIGNUP_PAYMENT_INTRO,
  getTrainerSignupAgreementBillingBullets,
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

  it("describes founding escrow split without implying immediate platform charge", () => {
    const copy = trainerSignupPaymentHoldExplanation("FOUNDING_BG_SURCHARGE_20PCT");
    expect(copy).toMatch(/screening portion/i);
    expect(copy).toMatch(/platform portion stays on hold/i);
    expect(copy).toMatch(/screening portion is captured/i);
    expect(copy).not.toMatch(/charged today/i);
  });

  it("agreement billing copy captures BG-on-screening and platform-on-approval", () => {
    expect(TRAINER_SIGNUP_AGREEMENT_BILLING_DOCUMENT).toMatch(/two temporary card holds/i);
    expect(TRAINER_SIGNUP_AGREEMENT_BILLING_DOCUMENT).toMatch(/When Checkr screening runs/i);
    expect(TRAINER_SIGNUP_AGREEMENT_BILLING_DOCUMENT).toMatch(/platform hold is released/i);
    expect(TRAINER_SIGNUP_AGREEMENT_BILLING_DOCUMENT).not.toMatch(/not applied to your account/i);
  });

  it("agreement bullets distinguish founding vs standard holds", () => {
    const founding = getTrainerSignupAgreementBillingBullets(true);
    const standard = getTrainerSignupAgreementBillingBullets(false);
    expect(founding.join(" ")).toMatch(/20% platform surcharge/i);
    expect(standard.join(" ")).toMatch(/\$100\.00/i);
    expect(founding.join(" ")).toMatch(/captured when Checkr runs/i);
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
