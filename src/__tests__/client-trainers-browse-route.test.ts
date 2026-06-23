import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  parseClientMatchPreferencesJsonMock,
  scoreTrainerForClientPrefsMock,
  trainerPassesStrictBrowseMock,
  isBrowsePassCooldownActiveMock,
  isWithinNotInterestedHistoryWindowMock,
  effectiveBrowsePassAtMock,
  isTrainerVisibleInClientDiscoveryMock,
  getSessionClientIdMock,
  getTrainerIdsHiddenFromClientMatchFeedMock,
  isMatchFitInternalQaClientEmailMock,
  refreshInternalQaClientSimulationIfNeededMock,
  clientFindUniqueMock,
  trainerFindManyMock,
  clientTrainerBrowsePassFindManyMock,
  clientSavedTrainerFindManyMock,
  trainerClientConversationFindManyMock,
} = vi.hoisted(() => ({
  parseClientMatchPreferencesJsonMock: vi.fn(),
  scoreTrainerForClientPrefsMock: vi.fn(),
  trainerPassesStrictBrowseMock: vi.fn(),
  isBrowsePassCooldownActiveMock: vi.fn(),
  isWithinNotInterestedHistoryWindowMock: vi.fn(),
  effectiveBrowsePassAtMock: vi.fn(),
  isTrainerVisibleInClientDiscoveryMock: vi.fn(),
  getSessionClientIdMock: vi.fn(),
  getTrainerIdsHiddenFromClientMatchFeedMock: vi.fn(),
  isMatchFitInternalQaClientEmailMock: vi.fn(),
  refreshInternalQaClientSimulationIfNeededMock: vi.fn(),
  clientFindUniqueMock: vi.fn(),
  trainerFindManyMock: vi.fn(),
  clientTrainerBrowsePassFindManyMock: vi.fn(),
  clientSavedTrainerFindManyMock: vi.fn(),
  trainerClientConversationFindManyMock: vi.fn(),
}));

vi.mock("@/lib/client-match-preferences", () => ({
  parseClientMatchPreferencesJson: parseClientMatchPreferencesJsonMock,
  scoreTrainerForClientPrefs: scoreTrainerForClientPrefsMock,
  trainerPassesStrictBrowse: trainerPassesStrictBrowseMock,
}));

vi.mock("@/lib/client-trainer-browse", () => ({
  CLIENT_TRAINER_NOT_INTERESTED_UI_HISTORY_DAYS: 30,
  CLIENT_TRAINER_PASS_COOLDOWN_DAYS: 14,
  effectiveBrowsePassAt: effectiveBrowsePassAtMock,
  isBrowsePassCooldownActive: isBrowsePassCooldownActiveMock,
  isWithinNotInterestedHistoryWindow: isWithinNotInterestedHistoryWindowMock,
}));

vi.mock("@/lib/trainer-client-discovery", () => ({
  isTrainerVisibleInClientDiscovery: isTrainerVisibleInClientDiscoveryMock,
  trainerVerificationBadgeForClient: vi.fn().mockReturnValue("verified"),
  trainerFpTrustBadgeForClient: vi.fn().mockReturnValue(null),
  clientDiscoveryVisibleTrainerProfileWhere: vi.fn(),
  trainerDiscoveryProfileSelect: {},
}));

vi.mock("@/lib/match-fit-public-marketplace-hidden", () => ({
  publicMarketplaceVisibleTrainerWhere: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/account-deletion-grace", () => ({
  marketplaceActiveTrainerWhere: {
    accountDeletedAt: null,
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      findUnique: clientFindUniqueMock,
    },
    trainer: {
      findMany: trainerFindManyMock,
    },
    clientTrainerBrowsePass: {
      findMany: clientTrainerBrowsePassFindManyMock,
    },
    clientSavedTrainer: {
      findMany: clientSavedTrainerFindManyMock,
    },
    trainerClientConversation: {
      findMany: trainerClientConversationFindManyMock,
    },
  },
}));

vi.mock("@/lib/session", () => ({
  getSessionClientId: getSessionClientIdMock,
}));

vi.mock("@/lib/client-plan-gate", () => ({
  requireClientNotFreemiumGated: vi.fn().mockResolvedValue(null),
  requireClientSwipeAllowed: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/user-block-queries", () => ({
  getTrainerIdsHiddenFromClientMatchFeed: getTrainerIdsHiddenFromClientMatchFeedMock,
}));

vi.mock("@/lib/match-fit-internal-qa", () => ({
  isMatchFitInternalQaClientEmail: isMatchFitInternalQaClientEmailMock,
  getMatchFitInternalQaClientEmails: vi.fn(() => []),
}));

vi.mock("@/lib/match-fit-public-marketplace-hidden", () => ({
  publicMarketplaceVisibleTrainerWhere: () => ({
    deidentifiedAt: null,
    accountDeletionFinalizeAt: null,
  }),
}));

vi.mock("@/lib/internal-qa-simulation", () => ({
  refreshInternalQaClientSimulationIfNeeded: refreshInternalQaClientSimulationIfNeededMock,
}));

import { GET } from "@/app/api/client/trainers/browse/route";

type MockTrainer = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  fitnessNiches: string[];
  profile: {
    dashboardActivatedAt: Date | null;
    limitedDashboardUnlockedAt?: Date | null;
    hasSignedTOS: boolean;
    hasUploadedW9: boolean;
    backgroundCheckStatus: "CLEAR";
    onboardingTrackCpt: boolean;
    onboardingTrackNutrition: boolean;
    onboardingTrackSpecialist: boolean;
    certificationReviewStatus: "APPROVED";
    nutritionistCertificationReviewStatus: "APPROVED";
    specialistCertificationReviewStatus: "APPROVED";
    aiMatchProfileText: string;
  };
};

function buildTrainer(overrides: Partial<MockTrainer> & Pick<MockTrainer, "id" | "username">): MockTrainer {
  return {
    id: overrides.id,
    username: overrides.username,
    firstName: overrides.firstName ?? "First",
    lastName: overrides.lastName ?? "Last",
    preferredName: overrides.preferredName ?? null,
    bio: overrides.bio ?? "Coach bio",
    profileImageUrl: overrides.profileImageUrl ?? null,
    fitnessNiches: overrides.fitnessNiches ?? ["General Fitness"],
    profile: {
      dashboardActivatedAt: new Date("2026-01-01T00:00:00.000Z"),
      limitedDashboardUnlockedAt: new Date("2026-01-01T00:00:00.000Z"),
      hasSignedTOS: true,
      hasUploadedW9: true,
      backgroundCheckStatus: "CLEAR",
      onboardingTrackCpt: true,
      onboardingTrackNutrition: false,
      onboardingTrackSpecialist: false,
      certificationReviewStatus: "APPROVED",
      nutritionistCertificationReviewStatus: "APPROVED",
      specialistCertificationReviewStatus: "APPROVED",
      aiMatchProfileText: "Experienced trainer",
      ...overrides.profile,
    },
  };
}

function makeRequest(query = ""): Request {
  return new Request(`https://matchfit.test/api/client/trainers/browse${query}`);
}

describe("GET /api/client/trainers/browse", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getSessionClientIdMock.mockResolvedValue("client_1");
    clientFindUniqueMock.mockResolvedValue({
      matchPreferencesJson: "{\"goals\":[\"strength\"]}",
      matchPreferencesCompletedAt: new Date("2026-01-01T00:00:00.000Z"),
      email: "member@example.com",
    });

    parseClientMatchPreferencesJsonMock.mockReturnValue({ goals: ["strength"] });
    scoreTrainerForClientPrefsMock.mockImplementation(
      (_prefs: unknown, trainer: { fitnessNiches: string[] }): { score: number; nicheHits: number; serviceOk: boolean; deliveryOk: boolean } => {
        if (trainer.fitnessNiches.includes("Strength")) {
          return { score: 95, nicheHits: 3, serviceOk: true, deliveryOk: true };
        }
        if (trainer.fitnessNiches.includes("Synthetic")) {
          return { score: 85, nicheHits: 2, serviceOk: true, deliveryOk: true };
        }
        return { score: 70, nicheHits: 1, serviceOk: true, deliveryOk: true };
      },
    );
    trainerPassesStrictBrowseMock.mockImplementation(
      (_prefs: unknown, metrics: { score: number }): boolean => metrics.score >= 80,
    );
    isTrainerVisibleInClientDiscoveryMock.mockReturnValue(true);
    isBrowsePassCooldownActiveMock.mockReturnValue(false);
    isWithinNotInterestedHistoryWindowMock.mockReturnValue(true);
    effectiveBrowsePassAtMock.mockReturnValue(new Date("2026-02-01T00:00:00.000Z"));

    trainerFindManyMock.mockResolvedValue([
      buildTrainer({
        id: "trainer_strength",
        username: "coach-strength",
        preferredName: "  Alex  ",
        fitnessNiches: ["Strength"],
      }),
      buildTrainer({
        id: "trainer_mobility",
        username: "coach-mobility",
        firstName: "",
        lastName: "",
        preferredName: null,
        fitnessNiches: ["Mobility"],
      }),
    ]);

    clientTrainerBrowsePassFindManyMock.mockResolvedValue([]);
    clientSavedTrainerFindManyMock.mockResolvedValue([]);
    trainerClientConversationFindManyMock.mockResolvedValue([]);
    getTrainerIdsHiddenFromClientMatchFeedMock.mockResolvedValue(new Set<string>());
    isMatchFitInternalQaClientEmailMock.mockReturnValue(false);
    refreshInternalQaClientSimulationIfNeededMock.mockResolvedValue(undefined);
  });

  it("returns 401 when no authenticated client session is present", async () => {
    getSessionClientIdMock.mockResolvedValueOnce(null);

    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(clientFindUniqueMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the authenticated client cannot be loaded", async () => {
    clientFindUniqueMock.mockResolvedValueOnce(null);

    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(trainerFindManyMock).not.toHaveBeenCalled();
  });

  it("returns the default swipe deck with strict-pass trainers only", async () => {
    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      feed: "swipe",
      passCooldownDays: 14,
      notInterestedHistoryDays: 30,
      relaxed: false,
      preferencesComplete: true,
    });
    expect(body.scrollTab).toBeUndefined();
    expect(body.scrollTabCounts).toBeUndefined();
    expect(body.trainers).toHaveLength(1);
    expect(body.trainers[0]).toMatchObject({
      id: "trainer_strength",
      displayName: "Alex",
      match: {
        strictPass: true,
      },
    });
  });

  it("falls back to scored results and marks the response as relaxed when strict filtering is empty", async () => {
    trainerPassesStrictBrowseMock.mockReturnValueOnce(false).mockReturnValueOnce(false);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.relaxed).toBe(true);
    expect(body.trainers.map((trainer: { id: string }) => trainer.id)).toEqual(["trainer_strength", "trainer_mobility"]);
    expect(body.trainers[1]).toMatchObject({
      id: "trainer_mobility",
      displayName: "Coach",
    });
  });

  it("builds the interested scroll tab in inquiry-priority order with tab counts", async () => {
    clientSavedTrainerFindManyMock.mockResolvedValueOnce([
      {
        trainerId: "trainer_mobility",
        trainerInquiryStatus: "DECLINED",
        createdAt: new Date("2026-01-04T00:00:00.000Z"),
      },
      {
        trainerId: "trainer_strength",
        trainerInquiryStatus: "PENDING_TRAINER",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    ]);

    const response = await GET(makeRequest("?feed=scroll&scrollTab=interested"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.feed).toBe("scroll");
    expect(body.scrollTab).toBe("interested");
    expect(body.scrollTabCounts).toEqual({
      new: 0,
      interested: 2,
      passed: 0,
    });
    expect(body.trainers.map((trainer: { id: string }) => trainer.id)).toEqual(["trainer_strength", "trainer_mobility"]);
    expect(body.trainers.map((trainer: { inquiryStatus?: string }) => trainer.inquiryStatus)).toEqual([
      "PENDING_TRAINER",
      "DECLINED",
    ]);
  });

  it("prepends synthetic internal-QA trainers and refreshes simulation state", async () => {
    isMatchFitInternalQaClientEmailMock.mockReturnValueOnce(true);
    trainerFindManyMock
      .mockResolvedValueOnce([
        buildTrainer({
          id: "trainer_strength",
          username: "coach-strength",
          preferredName: "Alex",
          fitnessNiches: ["Strength"],
        }),
      ])
      .mockResolvedValueOnce([
        buildTrainer({
          id: "trainer_synthetic",
          username: "coach-synthetic",
          preferredName: "Synthetic Sam",
          fitnessNiches: ["Synthetic"],
        }),
      ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(refreshInternalQaClientSimulationIfNeededMock).toHaveBeenCalledWith({
      clientId: "client_1",
      email: "member@example.com",
    });
    expect(trainerFindManyMock).toHaveBeenCalledTimes(2);
    expect(body.trainers.map((trainer: { id: string }) => trainer.id)).toEqual([
      "trainer_synthetic",
      "trainer_strength",
    ]);
  });

  it("includes pre-verified coaches when discovery visibility passes", async () => {
    isTrainerVisibleInClientDiscoveryMock.mockImplementation(
      (prof: { dashboardActivatedAt?: Date | null }) => prof?.dashboardActivatedAt == null,
    );
    trainerFindManyMock.mockResolvedValueOnce([
      buildTrainer({
        id: "trainer_pre",
        username: "coach-pre",
        preferredName: "Sam",
        fitnessNiches: ["Strength"],
        profile: {
          dashboardActivatedAt: null,
          limitedDashboardUnlockedAt: new Date("2026-01-15T00:00:00.000Z"),
          hasSignedTOS: true,
          hasUploadedW9: false,
          backgroundCheckStatus: "PENDING",
          certificationReviewStatus: "PENDING",
          nutritionistCertificationReviewStatus: "NOT_APPLICABLE",
          specialistCertificationReviewStatus: "NOT_APPLICABLE",
          aiMatchProfileText: "Pre-verified coach",
        },
      }),
    ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.trainers).toHaveLength(1);
    expect(body.trainers[0].id).toBe("trainer_pre");
  });

  it("returns 500 when data loading throws unexpectedly", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    trainerFindManyMock.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await GET(makeRequest());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Could not load Fitness Pros." });

    errorSpy.mockRestore();
  });
});
