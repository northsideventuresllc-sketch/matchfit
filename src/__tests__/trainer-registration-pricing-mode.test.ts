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
import {
  computeTrainerRegistrationDueCents,
  trainerRegistrationPricingModeForNewTrainer,
} from "@/lib/trainer-registration-fee";

describe("trainer-registration-pricing-mode", () => {
  it("maps legacy founding surcharge to covered BG tier", () => {
    expect(parseTrainerRegistrationPricingMode("FOUNDING_BG_SURCHARGE_20PCT")).toBe("FOUNDING_BG_COVERED");
    expect(isTrainerBackgroundCheckPlatformCovered("FOUNDING_BG_COVERED")).toBe(true);
    expect(trainerSignupRequiresBackgroundEscrowHold("FOUNDING_BG_COVERED")).toBe(false);
  });

  it("assigns the two onboarding bands by signup position (JB correction 2026-09-14: full 30, not 10)", () => {
    // 1-30 (the whole founding cohort): background check fully covered.
    expect(trainerRegistrationPricingModeForNewTrainer(0)).toBe("FOUNDING_BG_COVERED");
    expect(trainerRegistrationPricingModeForNewTrainer(9)).toBe("FOUNDING_BG_COVERED");
    expect(trainerRegistrationPricingModeForNewTrainer(10)).toBe("FOUNDING_BG_COVERED");
    expect(trainerRegistrationPricingModeForNewTrainer(29)).toBe("FOUNDING_BG_COVERED");
    // 31+ standard.
    expect(trainerRegistrationPricingModeForNewTrainer(30)).toBe("STANDARD_100_MINUS_BG");
    expect(trainerRegistrationPricingModeForNewTrainer(31)).toBe("STANDARD_100_MINUS_BG");
  });

  it("BETA_DISCOUNTED is no longer assigned to new sign-ups but still resolves correctly for legacy rows", () => {
    expect(isTrainerBackgroundCheckPlatformCovered("BETA_DISCOUNTED")).toBe(false);
    expect(trainerSignupRequiresBackgroundEscrowHold("BETA_DISCOUNTED")).toBe(true);
    expect(parseTrainerRegistrationPricingMode("BETA_DISCOUNTED")).toBe("BETA_DISCOUNTED");
  });

  it("charges the discounted band less than standard but more than nothing", () => {
    const bg = 3_000;
    const discounted = computeTrainerRegistrationDueCents({ pricingMode: "BETA_DISCOUNTED", backgroundCheckVendorPaidCents: bg });
    const standard = computeTrainerRegistrationDueCents({ pricingMode: "STANDARD_100_MINUS_BG", backgroundCheckVendorPaidCents: bg });
    expect(discounted.dueCents).toBeGreaterThan(0);
    expect(discounted.dueCents).toBeLessThan(standard.dueCents);
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
    expect(email.text).toContain("Request your Checkr screening invitation");
    expect(email.html).toContain("match-fit.net/trainer/onboarding");
  });
});
