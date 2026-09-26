import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, updateMock, findManyMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerProfile: {
      findUnique: findUniqueMock,
      update: updateMock,
      findMany: findManyMock,
    },
  },
}));

import {
  resolveFpListingStatusForCompliance,
  syncFpListingStatusForCompliance,
  repairStuckFpListingStatuses,
} from "@/lib/fp-listing-status-sync";

/** Matches the real-world "coachj" case from MF-PUBLIC-SEARCH-STUCK-LISTING-0923. */
function fullyCompliantProfile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    accountTier: "elite_fitness_pro",
    listingStatus: "pending_background",
    hasSignedTOS: true,
    hasUploadedW9: true,
    backgroundCheckStatus: "APPROVED",
    backgroundCheckClearedAt: new Date("2026-08-01"),
    onboardingTrackCpt: true,
    onboardingTrackNutrition: false,
    onboardingTrackSpecialist: false,
    certificationReviewStatus: "APPROVED",
    nutritionistCertificationReviewStatus: null,
    specialistCertificationReviewStatus: null,
    ...overrides,
  };
}

describe("resolveFpListingStatusForCompliance", () => {
  it("advances pending_background to active once compliance is fully complete", () => {
    expect(resolveFpListingStatusForCompliance(fullyCompliantProfile())).toBe("active");
  });

  it("advances pending_docs to active once compliance is fully complete", () => {
    expect(
      resolveFpListingStatusForCompliance(fullyCompliantProfile({ listingStatus: "pending_docs" })),
    ).toBe("active");
  });

  it("leaves pending_background alone when background check has not cleared", () => {
    expect(
      resolveFpListingStatusForCompliance(
        fullyCompliantProfile({ backgroundCheckStatus: "NOT_STARTED", backgroundCheckClearedAt: null }),
      ),
    ).toBe("pending_background");
  });

  it("leaves pending_docs alone when W-9 has not been uploaded", () => {
    expect(
      resolveFpListingStatusForCompliance(
        fullyCompliantProfile({ listingStatus: "pending_docs", hasUploadedW9: false }),
      ),
    ).toBe("pending_docs");
  });

  it("never downgrades an explicit active/paused/suspended status", () => {
    for (const status of ["active", "paused", "suspended"]) {
      expect(
        resolveFpListingStatusForCompliance(
          fullyCompliantProfile({ listingStatus: status, backgroundCheckStatus: "NOT_STARTED", backgroundCheckClearedAt: null }),
        ),
      ).toBe(status);
    }
  });

  it("never touches untiered (legacy, accountTier null) trainers", () => {
    expect(
      resolveFpListingStatusForCompliance(
        fullyCompliantProfile({ accountTier: null, hasUploadedW9: false, backgroundCheckStatus: "NOT_STARTED" }),
      ),
    ).toBe("pending_background");
  });
});

describe("syncFpListingStatusForCompliance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes 'active' and returns it when a stuck coach has actually cleared compliance", async () => {
    findUniqueMock.mockResolvedValue(fullyCompliantProfile());
    const result = await syncFpListingStatusForCompliance("trainer_1");
    expect(result).toBe("active");
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { trainerId: "trainer_1" },
        data: expect.objectContaining({ listingStatus: "active" }),
      }),
    );
  });

  it("is a no-op (no write) when nothing changed", async () => {
    findUniqueMock.mockResolvedValue(fullyCompliantProfile({ listingStatus: "active" }));
    const result = await syncFpListingStatusForCompliance("trainer_1");
    expect(result).toBeNull();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("returns null when the trainer profile does not exist", async () => {
    findUniqueMock.mockResolvedValue(null);
    const result = await syncFpListingStatusForCompliance("missing");
    expect(result).toBeNull();
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("repairStuckFpListingStatuses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("repairs every stuck-but-actually-compliant row and skips the rest", async () => {
    findManyMock.mockResolvedValue([
      { trainerId: "stuck_and_compliant", ...fullyCompliantProfile() },
      {
        trainerId: "stuck_and_incomplete",
        ...fullyCompliantProfile({ backgroundCheckStatus: "NOT_STARTED", backgroundCheckClearedAt: null }),
      },
    ]);

    const result = await repairStuckFpListingStatuses();

    expect(result.checked).toBe(2);
    expect(result.updatedTrainerIds).toEqual(["stuck_and_compliant"]);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { trainerId: "stuck_and_compliant" },
        data: expect.objectContaining({ listingStatus: "active" }),
      }),
    );
  });

  it("is fully idempotent — a second run is a no-op", async () => {
    findManyMock.mockResolvedValue([]);
    const result = await repairStuckFpListingStatuses();
    expect(result.checked).toBe(0);
    expect(result.updatedTrainerIds).toEqual([]);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
