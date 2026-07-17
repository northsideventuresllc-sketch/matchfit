import {
  TRAINER_PLATFORM_SUBSCRIPTION_USD,
  TRAINER_PLATFORM_TRIAL_DAYS,
  TRAINER_PAYMENT_GRACE_DAYS,
  trainerPlatformSubscriptionLabel,
} from "@/lib/trainer-platform-trial-constants";
import {
  TRAINER_SIGNUP_PREMIUM_PROMO_DAYS,
  trainerIndependentProTrialBenefitLabel,
  trainerIndependentProSubscriptionLabel,
} from "@/lib/trainer-signup-promo-copy";
import { TRAINER_PREMIUM_SUBSCRIPTION_USD } from "@/lib/platform-revenue-accounting";
import { TRAINER_FITHUB_PROMO_MS } from "@/lib/trainer-compliance-window";

describe("Independent Pro promo constants", () => {
  it("keeps 60-day free trial and $15/mo subscription congruent", () => {
    expect(TRAINER_PLATFORM_TRIAL_DAYS).toBe(60);
    expect(TRAINER_SIGNUP_PREMIUM_PROMO_DAYS).toBe(60);
    expect(TRAINER_PAYMENT_GRACE_DAYS).toBe(14);
    expect(TRAINER_PLATFORM_SUBSCRIPTION_USD).toBe(15);
    expect(TRAINER_PREMIUM_SUBSCRIPTION_USD).toBe(15);
    expect(trainerPlatformSubscriptionLabel()).toBe("$15.00 per month");
    expect(trainerIndependentProSubscriptionLabel()).toBe("$15.00 per month");
    expect(trainerIndependentProTrialBenefitLabel()).toBe("60 days free");
    expect(TRAINER_FITHUB_PROMO_MS).toBe(60 * 24 * 60 * 60 * 1000);
  });
});
