import {
  isTrainerAccountLoginBlocked,
  isTrainerBillingHardLocked,
  resolveTrainerPlatformAccessPhase,
  trainerNeedsPaymentSetup,
} from "@/lib/trainer-platform-access";

const base = {
  stripeSubscriptionId: null as string | null,
  stripeSubscriptionActive: false,
  subscriptionGraceUntil: null as Date | null,
  platformTrialEndsAt: null as Date | null,
  paymentGraceUntil: null as Date | null,
  accountDeactivatedAt: null as Date | null,
  platformTrialConsumed: false,
};

describe("trainer platform access", () => {
  const now = Date.parse("2026-07-16T12:00:00.000Z");

  it("treats active trial as platform_trial", () => {
    const fields = {
      ...base,
      platformTrialEndsAt: new Date("2026-08-16T12:00:00.000Z"),
    };
    expect(resolveTrainerPlatformAccessPhase(fields, now)).toBe("platform_trial");
    expect(isTrainerBillingHardLocked(fields, now)).toBe(false);
    expect(trainerNeedsPaymentSetup(fields, now)).toBe(false);
    expect(isTrainerAccountLoginBlocked(fields, now)).toBe(false);
  });

  it("hard-locks and prompts payment during payment grace", () => {
    const fields = {
      ...base,
      platformTrialEndsAt: new Date("2026-07-01T12:00:00.000Z"),
      paymentGraceUntil: new Date("2026-07-30T12:00:00.000Z"),
      platformTrialConsumed: true,
    };
    expect(resolveTrainerPlatformAccessPhase(fields, now)).toBe("payment_grace");
    expect(isTrainerBillingHardLocked(fields, now)).toBe(true);
    expect(trainerNeedsPaymentSetup(fields, now)).toBe(true);
    expect(isTrainerAccountLoginBlocked(fields, now)).toBe(false);
  });

  it("blocks login after deactivation", () => {
    const fields = {
      ...base,
      platformTrialEndsAt: new Date("2026-06-01T12:00:00.000Z"),
      paymentGraceUntil: new Date("2026-06-15T12:00:00.000Z"),
      accountDeactivatedAt: new Date("2026-06-15T12:00:00.000Z"),
      platformTrialConsumed: true,
    };
    expect(resolveTrainerPlatformAccessPhase(fields, now)).toBe("deactivated");
    expect(isTrainerAccountLoginBlocked(fields, now)).toBe(true);
    expect(trainerNeedsPaymentSetup(fields, now)).toBe(true);
  });

  it("treats active Stripe subscription as paid", () => {
    const fields = {
      ...base,
      stripeSubscriptionId: "sub_test",
      stripeSubscriptionActive: true,
      platformTrialConsumed: true,
    };
    expect(resolveTrainerPlatformAccessPhase(fields, now)).toBe("paid");
    expect(isTrainerBillingHardLocked(fields, now)).toBe(false);
  });
});
