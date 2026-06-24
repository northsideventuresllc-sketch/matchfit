import { describe, expect, it } from "vitest";
import {
  emptyAdminFinanceClientSegment,
  emptyAdminFinanceFpTierSegment,
  emptyAdminFinancesPanelSegments,
} from "@/lib/admin-finance-segments";
import {
  adminMemberOverviewInactiveClientWhere,
  adminMemberOverviewVipPlanClientWhere,
} from "@/lib/admin-portal-list-filters";

describe("admin-finance-segments", () => {
  it("returns empty segment shells for all cohorts", () => {
    const segments = emptyAdminFinancesPanelSegments();
    expect(segments.freePlanClients.clientCount).toBe(0);
    expect(segments.matchFitPros.tier).toBe("match_fit_pro");
    expect(segments.matchFitPremiumPros.label).toBe("Match Fit Premium Pro");
    expect(segments.independentFitnessPros.monthlySubscriptionsActive).toBe(0);
    expect(segments.eliteFitnessPros.liveFitPros).toBe(0);
  });

  it("builds empty client and FP tier segment defaults", () => {
    const client = emptyAdminFinanceClientSegment();
    expect(client.lifetime.serviceSpendCents).toBe(0);
    const fp = emptyAdminFinanceFpTierSegment("independent_fitness_pro");
    expect(fp.tier).toBe("independent_fitness_pro");
    expect(fp.lifetime.tokenRevenueCents).toBe(0);
  });
});

describe("admin finance list filters", () => {
  const now = new Date("2026-06-24T12:00:00.000Z");

  it("defines VIP plan client where with trial or paying VIP", () => {
    const where = adminMemberOverviewVipPlanClientWhere(now);
    expect(where.OR).toBeDefined();
    expect(Array.isArray(where.OR)).toBe(true);
  });

  it("defines inactive client where with inactivity threshold", () => {
    const where = adminMemberOverviewInactiveClientWhere(now);
    expect(where.updatedAt).toBeDefined();
    expect(where.NOT).toBeDefined();
  });
});
