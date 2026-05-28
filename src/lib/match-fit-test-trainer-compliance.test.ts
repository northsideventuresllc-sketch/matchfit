import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TRAINER_DEV_FAKE_CPT_CERTIFICATION_PATH,
  TRAINER_DEV_FAKE_NUTRITION_CERTIFICATION_PATH,
} from "@/lib/trainer-dev-cert-placeholders";

const {
  mockTrainerFindUnique,
  mockTrainerProfileUpsert,
  mockMaybeActivateTrainerDashboard,
} = vi.hoisted(() => ({
  mockTrainerFindUnique: vi.fn(),
  mockTrainerProfileUpsert: vi.fn(),
  mockMaybeActivateTrainerDashboard: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: {
      findUnique: mockTrainerFindUnique,
    },
    trainerProfile: {
      upsert: mockTrainerProfileUpsert,
    },
  },
}));

vi.mock("@/lib/trainer-onboarding-dashboard", () => ({
  maybeActivateTrainerDashboard: mockMaybeActivateTrainerDashboard,
}));

import {
  applyMatchFitTestTrainerCompliance,
  getMatchFitTestTrainerEmails,
  isMatchFitTestTrainerEmail,
  matchFitTestTrainerProfileComplianceData,
} from "./match-fit-test-trainer-compliance";

describe("match-fit-test-trainer-compliance", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.MATCH_FIT_TEST_TRAINER_EMAILS;
    mockTrainerFindUnique.mockResolvedValue(null);
    mockTrainerProfileUpsert.mockResolvedValue({});
    mockMaybeActivateTrainerDashboard.mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("normalizes allowlisted emails from env", () => {
    process.env.MATCH_FIT_TEST_TRAINER_EMAILS = "OWNER@MATCHFIT.COM,  qa@matchfit.com  , ,";

    expect(getMatchFitTestTrainerEmails()).toEqual(["owner@matchfit.com", "qa@matchfit.com"]);
  });

  it("matches allowlisted emails case-insensitively", () => {
    process.env.MATCH_FIT_TEST_TRAINER_EMAILS = "owner@matchfit.com";

    expect(isMatchFitTestTrainerEmail(" OWNER@MATCHFIT.COM ")).toBe(true);
    expect(isMatchFitTestTrainerEmail("other@matchfit.com")).toBe(false);
    expect(isMatchFitTestTrainerEmail("   ")).toBe(false);
  });

  it("builds a fully approved compliance profile payload", () => {
    const now = new Date("2026-05-27T19:00:00.000Z");

    expect(matchFitTestTrainerProfileComplianceData(now)).toEqual(
      expect.objectContaining({
        hasSignedTOS: true,
        hasUploadedW9: true,
        hasPaidBackgroundFee: true,
        hasPaidRegistrationFee: true,
        backgroundCheckStatus: "APPROVED",
        certificationReviewStatus: "APPROVED",
        nutritionistCertificationReviewStatus: "APPROVED",
        certificationUrl: TRAINER_DEV_FAKE_CPT_CERTIFICATION_PATH,
        nutritionistCertificationUrl: TRAINER_DEV_FAKE_NUTRITION_CERTIFICATION_PATH,
        dashboardActivatedAt: now,
        premiumStudioEnabledAt: now,
        matchQuestionnaireStatus: "completed",
        matchQuestionnaireCompletedAt: now,
      }),
    );
  });

  it("returns false when trainer does not exist or is not allowlisted", async () => {
    mockTrainerFindUnique.mockResolvedValueOnce(null);
    await expect(applyMatchFitTestTrainerCompliance("trainer_missing")).resolves.toBe(false);

    mockTrainerFindUnique.mockResolvedValueOnce({ email: "outside@matchfit.com" });
    await expect(applyMatchFitTestTrainerCompliance("trainer_external")).resolves.toBe(false);

    expect(mockTrainerProfileUpsert).not.toHaveBeenCalled();
    expect(mockMaybeActivateTrainerDashboard).not.toHaveBeenCalled();
  });

  it("upserts profile and activates dashboard for allowlisted trainer emails", async () => {
    process.env.MATCH_FIT_TEST_TRAINER_EMAILS = "owner@matchfit.com";
    mockTrainerFindUnique.mockResolvedValueOnce({ email: "OWNER@MATCHFIT.COM" });

    await expect(applyMatchFitTestTrainerCompliance("trainer_1")).resolves.toBe(true);

    expect(mockTrainerProfileUpsert).toHaveBeenCalledTimes(1);
    expect(mockTrainerProfileUpsert).toHaveBeenCalledWith({
      where: { trainerId: "trainer_1" },
      create: expect.objectContaining({
        trainerId: "trainer_1",
        backgroundCheckStatus: "APPROVED",
        certificationUrl: TRAINER_DEV_FAKE_CPT_CERTIFICATION_PATH,
        nutritionistCertificationUrl: TRAINER_DEV_FAKE_NUTRITION_CERTIFICATION_PATH,
      }),
      update: expect.objectContaining({
        backgroundCheckStatus: "APPROVED",
        matchQuestionnaireStatus: "completed",
      }),
    });
    expect(mockMaybeActivateTrainerDashboard).toHaveBeenCalledWith("trainer_1");
  });
});
