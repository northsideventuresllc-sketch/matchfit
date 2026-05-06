import { describe, expect, it } from "vitest";
import {
  trainerOffersNutritionServices,
  trainerOffersPersonalTrainingServices,
} from "@/lib/trainer-service-buckets";
import { defaultClientMatchPreferences, trainerMatchesServiceTypes } from "@/lib/client-match-preferences";

describe("trainer service buckets", () => {
  it("allows personal training offerings with approved specialist track (no CPT)", () => {
    expect(
      trainerOffersPersonalTrainingServices({
        onboardingTrackCpt: false,
        onboardingTrackNutrition: false,
        onboardingTrackSpecialist: true,
        certificationReviewStatus: "NOT_STARTED",
        nutritionistCertificationReviewStatus: "NOT_STARTED",
        specialistCertificationReviewStatus: "APPROVED",
      }),
    ).toBe(true);
  });

  it("requires CPT track and APPROVED for personal training offerings", () => {
    expect(
      trainerOffersPersonalTrainingServices({
        onboardingTrackCpt: true,
        onboardingTrackNutrition: false,
        certificationReviewStatus: "PENDING",
        nutritionistCertificationReviewStatus: "NOT_STARTED",
      }),
    ).toBe(false);
    expect(
      trainerOffersPersonalTrainingServices({
        onboardingTrackCpt: true,
        onboardingTrackNutrition: false,
        certificationReviewStatus: "APPROVED",
        nutritionistCertificationReviewStatus: "NOT_STARTED",
      }),
    ).toBe(true);
  });

  it("requires nutrition track and APPROVED for nutrition offerings", () => {
    expect(
      trainerOffersNutritionServices({
        onboardingTrackCpt: false,
        onboardingTrackNutrition: true,
        certificationReviewStatus: "NOT_STARTED",
        nutritionistCertificationReviewStatus: "PENDING",
      }),
    ).toBe(false);
    expect(
      trainerOffersNutritionServices({
        onboardingTrackCpt: false,
        onboardingTrackNutrition: true,
        certificationReviewStatus: "NOT_STARTED",
        nutritionistCertificationReviewStatus: "APPROVED",
      }),
    ).toBe(true);
  });

  it("trainerMatchesServiceTypes uses approved credentials", () => {
    const prefs = {
      ...defaultClientMatchPreferences,
      serviceTypes: ["personal_training", "nutrition"] as ("personal_training" | "nutrition")[],
    };
    const p = {
      onboardingTrackCpt: true,
      onboardingTrackNutrition: true,
      certificationReviewStatus: "APPROVED",
      nutritionistCertificationReviewStatus: "PENDING",
    };
    expect(trainerMatchesServiceTypes(prefs, p)).toBe(true);
    expect(
      trainerMatchesServiceTypes(prefs, {
        ...p,
        certificationReviewStatus: "PENDING",
        nutritionistCertificationReviewStatus: "APPROVED",
      }),
    ).toBe(true);
    expect(
      trainerMatchesServiceTypes(prefs, {
        ...p,
        certificationReviewStatus: "PENDING",
        nutritionistCertificationReviewStatus: "PENDING",
      }),
    ).toBe(false);
  });
});
