import { describe, expect, it } from "vitest";
import {
  isTrainerOnboardingFeePaymentOverdue,
  trainerOnboardingFeeDeadlineAt,
  trainerOnboardingFeeDaysRemaining,
  trainerOnboardingFeeIsCaptured,
  trainerOnboardingFeeIsPaid,
  TRAINER_ONBOARDING_FEE_DEADLINE_MS,
} from "@/lib/trainer-onboarding-fee-deadline";

describe("trainer onboarding fee deadline helpers", () => {
  it("calculates deadline exactly seven days from a given date", () => {
    const from = new Date("2026-06-01T12:00:00.000Z");
    const deadline = trainerOnboardingFeeDeadlineAt(from);
    expect(deadline.getTime()).toBe(from.getTime() + TRAINER_ONBOARDING_FEE_DEADLINE_MS);
  });

  it("treats explicit paid flag or held/captured status as paid", () => {
    expect(trainerOnboardingFeeIsPaid({ hasPaidRegistrationFee: true })).toBe(true);
    expect(trainerOnboardingFeeIsPaid({ registrationFeeHoldStatus: " held " })).toBe(true);
    expect(trainerOnboardingFeeIsPaid({ registrationFeeHoldStatus: "CAPTURED" })).toBe(true);
    expect(trainerOnboardingFeeIsPaid({ registrationFeeHoldStatus: "not_started" })).toBe(false);
  });

  it("treats captured or explicit paid as completed fee, not hold-only", () => {
    expect(trainerOnboardingFeeIsCaptured({ hasPaidRegistrationFee: true })).toBe(true);
    expect(trainerOnboardingFeeIsCaptured({ registrationFeeHoldStatus: "CAPTURED" })).toBe(true);
    expect(trainerOnboardingFeeIsCaptured({ registrationFeeHoldStatus: "HELD" })).toBe(false);
    expect(trainerOnboardingFeeIsCaptured({ registrationFeeHoldStatus: "NOT_STARTED" })).toBe(false);
  });

  it("flags overdue only when unpaid and now is past a valid deadline", () => {
    const now = new Date("2026-06-08T00:00:00.000Z");

    expect(
      isTrainerOnboardingFeePaymentOverdue(
        { onboardingFeePaymentDeadlineAt: "2026-06-07T23:59:59.000Z", registrationFeeHoldStatus: "NOT_STARTED" },
        now,
      ),
    ).toBe(true);

    expect(
      isTrainerOnboardingFeePaymentOverdue(
        { onboardingFeePaymentDeadlineAt: "2026-06-08T00:00:00.000Z", registrationFeeHoldStatus: "NOT_STARTED" },
        now,
      ),
    ).toBe(false);

    expect(
      isTrainerOnboardingFeePaymentOverdue(
        { onboardingFeePaymentDeadlineAt: "not-a-date", registrationFeeHoldStatus: "NOT_STARTED" },
        now,
      ),
    ).toBe(false);
  });

  it("returns remaining days with ceil behavior and handles overdue/invalid states", () => {
    const now = new Date("2026-06-08T00:00:00.000Z");
    expect(
      trainerOnboardingFeeDaysRemaining(
        {
          onboardingFeePaymentDeadlineAt: new Date("2026-06-10T00:00:00.000Z"),
          registrationFeeHoldStatus: "NOT_STARTED",
        },
        now,
      ),
    ).toBe(2);

    expect(
      trainerOnboardingFeeDaysRemaining(
        {
          onboardingFeePaymentDeadlineAt: new Date("2026-06-08T00:00:01.000Z"),
          registrationFeeHoldStatus: "NOT_STARTED",
        },
        now,
      ),
    ).toBe(1);

    expect(
      trainerOnboardingFeeDaysRemaining(
        {
          onboardingFeePaymentDeadlineAt: new Date("2026-06-07T23:59:59.000Z"),
          registrationFeeHoldStatus: "NOT_STARTED",
        },
        now,
      ),
    ).toBe(0);

    expect(trainerOnboardingFeeDaysRemaining({ hasPaidRegistrationFee: true }, now)).toBeNull();
    expect(trainerOnboardingFeeDaysRemaining({ onboardingFeePaymentDeadlineAt: "bad-date" }, now)).toBeNull();
  });
});
