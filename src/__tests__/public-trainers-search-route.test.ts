import { beforeEach, describe, expect, it, vi } from "vitest";

const { trainerFindManyMock, simpleRateLimitAllowMock } = vi.hoisted(() => ({
  trainerFindManyMock: vi.fn(),
  simpleRateLimitAllowMock: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: { findMany: trainerFindManyMock },
  },
}));

vi.mock("@/lib/simple-rate-limit", () => ({
  simpleRateLimitAllow: simpleRateLimitAllowMock,
}));

vi.mock("@/lib/app-origin", () => ({
  getAppOrigin: () => "https://match-fit.net",
}));

import { GET } from "@/app/api/public/trainers/search/route";

function baseTrainerRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    username: "coach-jane",
    firstName: "Jane",
    lastName: "Doe",
    preferredName: null,
    bio: "I help busy professionals build strength online.",
    fitnessNiches: "strength training, nutrition coaching",
    email: "jane@example.com",
    phone: "555-123-4567",
    address: "123 Secret St",
    id: "trainer_internal_id_123",
    profile: {
      dashboardActivatedAt: new Date("2026-01-01"),
      limitedDashboardUnlockedAt: new Date("2025-12-01"),
      hasSignedTOS: true,
      hasUploadedW9: true,
      backgroundCheckStatus: "APPROVED",
      backgroundCheckClearedAt: new Date("2025-12-15"),
      onboardingTrackCpt: true,
      onboardingTrackNutrition: false,
      onboardingTrackSpecialist: false,
      certificationReviewStatus: "APPROVED",
      nutritionistCertificationReviewStatus: null,
      specialistCertificationReviewStatus: null,
      accountTier: null,
      listingStatus: "active",
      serviceOfferingsJson: JSON.stringify({
        schemaVersion: 1,
        services: [
          {
            serviceId: "one_on_one_pt",
            priceUsd: 80,
            billingUnit: "per_hour",
            delivery: "virtual",
            sessionMinutes: 60,
          },
        ],
      }),
    },
    ...overrides,
  };
}

describe("GET /api/public/trainers/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    simpleRateLimitAllowMock.mockReturnValue(true);
  });

  it("never returns private fields (email, phone, address, internal id)", async () => {
    trainerFindManyMock.mockResolvedValue([baseTrainerRow()]);

    const res = await GET(new Request("https://matchfit.test/api/public/trainers/search"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { trainers: Array<Record<string, unknown>> };
    expect(body.trainers).toHaveLength(1);

    const raw = JSON.stringify(body);
    expect(raw).not.toContain("jane@example.com");
    expect(raw).not.toContain("555-123-4567");
    expect(raw).not.toContain("123 Secret St");
    expect(raw).not.toContain("trainer_internal_id_123");

    const trainer = body.trainers[0]!;
    expect(Object.keys(trainer).sort()).toEqual(
      ["displayName", "lowestPublishedPriceUsd", "niches", "profileUrl", "shortBio", "username"].sort(),
    );
    expect(trainer.username).toBe("coach-jane");
    expect(trainer.profileUrl).toBe("https://match-fit.net/trainers/coach-jane");
    expect(trainer.lowestPublishedPriceUsd).toBe(80);
    expect(trainer.niches).toEqual(["strength training", "nutrition coaching"]);
  });

  it("never returns geo fields (nationwide-only product)", async () => {
    trainerFindManyMock.mockResolvedValue([baseTrainerRow()]);
    const res = await GET(new Request("https://matchfit.test/api/public/trainers/search"));
    const body = (await res.json()) as { trainers: Array<Record<string, unknown>> };
    const raw = JSON.stringify(body).toLowerCase();
    expect(raw).not.toMatch(/\bzip\b|\bcity\b|\blat\b|\blng\b|\blongitude\b|\blatitude\b/);
  });

  it("excludes trainers not visible in client discovery (not TOS-signed / not activated)", async () => {
    trainerFindManyMock.mockResolvedValue([
      baseTrainerRow({
        profile: {
          ...baseTrainerRow().profile,
          hasSignedTOS: false,
          limitedDashboardUnlockedAt: null,
          dashboardActivatedAt: null,
        },
      }),
    ]);
    const res = await GET(new Request("https://matchfit.test/api/public/trainers/search"));
    const body = (await res.json()) as { trainers: unknown[] };
    expect(body.trainers).toHaveLength(0);
  });

  it("filters by specialty free text against niches/bio, case-insensitive", async () => {
    trainerFindManyMock.mockResolvedValue([baseTrainerRow()]);

    const hit = await GET(
      new Request("https://matchfit.test/api/public/trainers/search?specialty=STRENGTH"),
    );
    expect(((await hit.json()) as { trainers: unknown[] }).trainers).toHaveLength(1);

    const miss = await GET(
      new Request("https://matchfit.test/api/public/trainers/search?specialty=powerlifting-only-nomatch"),
    );
    expect(((await miss.json()) as { trainers: unknown[] }).trainers).toHaveLength(0);
  });

  it("filters by max_monthly_budget against the lowest published price", async () => {
    trainerFindManyMock.mockResolvedValue([baseTrainerRow()]);

    const underBudget = await GET(
      new Request("https://matchfit.test/api/public/trainers/search?max_monthly_budget=100"),
    );
    expect(((await underBudget.json()) as { trainers: unknown[] }).trainers).toHaveLength(1);

    const overBudget = await GET(
      new Request("https://matchfit.test/api/public/trainers/search?max_monthly_budget=10"),
    );
    expect(((await overBudget.json()) as { trainers: unknown[] }).trainers).toHaveLength(0);
  });

  it("hides services marked siteVisibility hidden or booking unavailable from the price calc", async () => {
    trainerFindManyMock.mockResolvedValue([
      baseTrainerRow({
        profile: {
          ...baseTrainerRow().profile,
          serviceOfferingsJson: JSON.stringify({
            schemaVersion: 1,
            services: [
              { serviceId: "one_on_one_pt", priceUsd: 80, billingUnit: "per_hour", delivery: "virtual", sessionMinutes: 60, siteVisibility: "hidden" },
              { serviceId: "nutrition_coaching", priceUsd: 40, billingUnit: "per_hour", delivery: "virtual", sessionMinutes: 60, clientBookingAvailability: "unavailable" },
            ],
          }),
        },
      }),
    ]);
    const res = await GET(new Request("https://matchfit.test/api/public/trainers/search"));
    const body = (await res.json()) as { trainers: Array<{ lowestPublishedPriceUsd: number | null }> };
    expect(body.trainers[0]!.lowestPublishedPriceUsd).toBeNull();
  });

  it("clamps limit to the 1-50 range and defaults to 20", async () => {
    trainerFindManyMock.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => baseTrainerRow({ username: `coach-${i}` })),
    );

    const withDefault = await GET(new Request("https://matchfit.test/api/public/trainers/search"));
    expect(withDefault.status).toBe(200);
    const defaultBody = (await withDefault.json()) as { trainers: unknown[]; limit: number };
    expect(defaultBody.limit).toBe(20);

    const withHighLimit = await GET(
      new Request("https://matchfit.test/api/public/trainers/search?limit=999"),
    );
    const highBody = (await withHighLimit.json()) as { trainers: unknown[]; limit: number };
    expect(highBody.limit).toBe(50);
    expect(highBody.trainers.length).toBeLessThanOrEqual(50);
  });

  it("returns 429 when the per-IP rate limit is exceeded", async () => {
    simpleRateLimitAllowMock.mockReturnValue(false);
    trainerFindManyMock.mockResolvedValue([baseTrainerRow()]);
    const res = await GET(new Request("https://matchfit.test/api/public/trainers/search"));
    expect(res.status).toBe(429);
  });

  it("requires no authentication (no session/client lookup is ever called)", async () => {
    trainerFindManyMock.mockResolvedValue([baseTrainerRow()]);
    const res = await GET(new Request("https://matchfit.test/api/public/trainers/search"));
    expect(res.status).not.toBe(401);
  });
});
