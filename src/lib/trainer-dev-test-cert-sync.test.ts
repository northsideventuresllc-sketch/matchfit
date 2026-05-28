import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TRAINER_DEV_FAKE_CPT_CERTIFICATION_PATH,
  TRAINER_DEV_FAKE_NUTRITION_CERTIFICATION_PATH,
} from "@/lib/trainer-dev-cert-placeholders";

const {
  mockIsMatchFitTestTrainerEmail,
  mockApplyMatchFitTestTrainerCompliance,
  mockTrainerProfileFindUnique,
  mockTrainerProfileUpdate,
  mockMaybeActivateTrainerDashboard,
} = vi.hoisted(() => ({
  mockIsMatchFitTestTrainerEmail: vi.fn(),
  mockApplyMatchFitTestTrainerCompliance: vi.fn(),
  mockTrainerProfileFindUnique: vi.fn(),
  mockTrainerProfileUpdate: vi.fn(),
  mockMaybeActivateTrainerDashboard: vi.fn(),
}));

vi.mock("@/lib/match-fit-test-trainer-compliance", () => ({
  isMatchFitTestTrainerEmail: mockIsMatchFitTestTrainerEmail,
  applyMatchFitTestTrainerCompliance: mockApplyMatchFitTestTrainerCompliance,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerProfile: {
      findUnique: mockTrainerProfileFindUnique,
      update: mockTrainerProfileUpdate,
    },
  },
}));

vi.mock("@/lib/trainer-onboarding-dashboard", () => ({
  maybeActivateTrainerDashboard: mockMaybeActivateTrainerDashboard,
}));

import {
  shouldSyncDevelopmentTestTrainerCertifications,
  syncDevelopmentTestTrainerCertificationsForTrainer,
} from "./trainer-dev-test-cert-sync";

describe("trainer-dev-test-cert-sync", () => {
  const originalEnv = { ...process.env };
  const trainer = {
    id: "trainer_1",
    username: "coach_alpha",
    email: "trainer@matchfit.com",
    phone: "+14045551234",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, NODE_ENV: "development" };
    delete process.env.MATCH_FIT_TEST_TRAINER_USERNAMES;
    delete process.env.MATCH_FIT_DEV_TRAINER_IDENTIFIER;
    delete process.env.MATCH_FIT_DEV_APPROVE_ALL_TRAINER_CERTS;
    mockIsMatchFitTestTrainerEmail.mockReturnValue(false);
    mockApplyMatchFitTestTrainerCompliance.mockResolvedValue(true);
    mockTrainerProfileFindUnique.mockResolvedValue(null);
    mockTrainerProfileUpdate.mockResolvedValue({});
    mockMaybeActivateTrainerDashboard.mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns true when trainer email is in the Match Fit test allowlist", () => {
    mockIsMatchFitTestTrainerEmail.mockReturnValueOnce(true);

    expect(shouldSyncDevelopmentTestTrainerCertifications(trainer)).toBe(true);
  });

  it("returns false outside development when trainer is not allowlisted", () => {
    process.env = { ...process.env, NODE_ENV: "production" };

    expect(shouldSyncDevelopmentTestTrainerCertifications(trainer)).toBe(false);
  });

  it("supports development allowlist matching by username and identifier", () => {
    process.env.MATCH_FIT_TEST_TRAINER_USERNAMES = "other_user, coach_alpha";
    expect(shouldSyncDevelopmentTestTrainerCertifications(trainer)).toBe(true);

    process.env.MATCH_FIT_TEST_TRAINER_USERNAMES = "other_user";
    process.env.MATCH_FIT_DEV_TRAINER_IDENTIFIER = "TRAINER@MATCHFIT.COM";
    expect(shouldSyncDevelopmentTestTrainerCertifications(trainer)).toBe(true);
  });

  it("can globally enable dev auto-approval using a truthy env flag", () => {
    process.env.MATCH_FIT_DEV_APPROVE_ALL_TRAINER_CERTS = "yes";

    expect(shouldSyncDevelopmentTestTrainerCertifications(trainer)).toBe(true);
  });

  it("delegates to full Match Fit compliance for allowlisted trainer emails", async () => {
    mockIsMatchFitTestTrainerEmail.mockReturnValue(true);
    mockApplyMatchFitTestTrainerCompliance.mockResolvedValueOnce(false);

    await expect(syncDevelopmentTestTrainerCertificationsForTrainer(trainer)).resolves.toBe(false);

    expect(mockApplyMatchFitTestTrainerCompliance).toHaveBeenCalledWith("trainer_1");
    expect(mockTrainerProfileUpdate).not.toHaveBeenCalled();
  });

  it("updates missing development certification fields and activates dashboard", async () => {
    process.env.MATCH_FIT_TEST_TRAINER_USERNAMES = "coach_alpha";
    mockTrainerProfileFindUnique.mockResolvedValueOnce({
      onboardingTrackCpt: false,
      onboardingTrackNutrition: false,
      certificationReviewStatus: "PENDING",
      nutritionistCertificationReviewStatus: "NOT_STARTED",
      certificationUrl: "   ",
      nutritionistCertificationUrl: "",
    });

    await expect(syncDevelopmentTestTrainerCertificationsForTrainer(trainer)).resolves.toBe(true);

    expect(mockTrainerProfileUpdate).toHaveBeenCalledWith({
      where: { trainerId: "trainer_1" },
      data: {
        onboardingTrackCpt: true,
        onboardingTrackNutrition: true,
        certificationReviewStatus: "APPROVED",
        nutritionistCertificationReviewStatus: "APPROVED",
        certificationUrl: TRAINER_DEV_FAKE_CPT_CERTIFICATION_PATH,
        nutritionistCertificationUrl: TRAINER_DEV_FAKE_NUTRITION_CERTIFICATION_PATH,
      },
    });
    expect(mockMaybeActivateTrainerDashboard).toHaveBeenCalledWith("trainer_1");
  });

  it("returns false when the profile is already fully approved", async () => {
    process.env.MATCH_FIT_TEST_TRAINER_USERNAMES = "coach_alpha";
    mockTrainerProfileFindUnique.mockResolvedValueOnce({
      onboardingTrackCpt: true,
      onboardingTrackNutrition: true,
      certificationReviewStatus: "APPROVED",
      nutritionistCertificationReviewStatus: "APPROVED",
      certificationUrl: "/existing-cpt.pdf",
      nutritionistCertificationUrl: "/existing-nutrition.pdf",
    });

    await expect(syncDevelopmentTestTrainerCertificationsForTrainer(trainer)).resolves.toBe(false);

    expect(mockTrainerProfileUpdate).not.toHaveBeenCalled();
    expect(mockMaybeActivateTrainerDashboard).not.toHaveBeenCalled();
  });
});
