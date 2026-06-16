import { describe, expect, it } from "vitest";
import {
  buildFoundingBgCoveredTrainerEmail,
  isKristianFoundingBgCoveredTrainer,
} from "@/lib/trainer-founding-bg-covered";
import {
  isTrainerBackgroundCheckPlatformCovered,
  parseTrainerRegistrationPricingMode,
  trainerSignupRequiresBackgroundEscrowHold,
} from "@/lib/trainer-registration-pricing-mode";
import { computeTrainerSignupEscrowSplit } from "@/lib/trainer-signup-escrow-split";
import { trainerRegistrationPricingModeForNewTrainer } from "@/lib/trainer-registration-fee";

describe("trainer-registration-pricing-mode", () => {
  it("maps legacy founding surcharge to covered BG tier", () => {
    expect(parseTrainerRegistrationPricingMode("FOUNDING_BG_SURCHARGE_20PCT")).toBe("FOUNDING_BG_COVERED");
    expect(isTrainerBackgroundCheckPlatformCovered("FOUNDING_BG_COVERED")).toBe(true);
    expect(trainerSignupRequiresBackgroundEscrowHold("FOUNDING_BG_COVERED")).toBe(false);
  });

  it("assigns covered tier for first trainers before cap", () => {
    expect(trainerRegistrationPricingModeForNewTrainer(0)).toBe("FOUNDING_BG_COVERED");
    expect(trainerRegistrationPricingModeForNewTrainer(9)).toBe("FOUNDING_BG_COVERED");
    expect(trainerRegistrationPricingModeForNewTrainer(10)).toBe("STANDARD_100_MINUS_BG");
  });

  it("founding covered escrow has no background slice", () => {
    const split = computeTrainerSignupEscrowSplit("FOUNDING_BG_COVERED");
    expect(split.backgroundCheckEscrowCents).toBe(0);
    expect(split.platformEscrowCents).toBeGreaterThan(0);
  });
});

describe("trainer-founding-bg-covered email", () => {
  it("identifies Kristian by name", () => {
    expect(isKristianFoundingBgCoveredTrainer({ firstName: "Kristian", username: "coach1" })).toBe(true);
  });

  it("builds onboarding instructions", () => {
    const email = buildFoundingBgCoveredTrainerEmail({ firstName: "Kristian" });
    expect(email.subject).toContain("background check is covered");
    expect(email.text).toContain("Request your Checkr invitation");
    expect(email.html).toContain("match-fit.net/trainer/onboarding");
  });
});
