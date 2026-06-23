import { describe, expect, it } from "vitest";
import {
  FP_PERMISSIONS,
  getFpTierPermissions,
  fpTrustIndicatorLabel,
} from "@/lib/fp-tier-permissions";
import {
  fpTierSwitchLockActive,
  evaluateFpTierSwitchEligibility,
  resolveListingStatusAfterTierSwitch,
} from "@/lib/fp-tier-switching";
import { fpDocsCompleteForTier } from "@/lib/fp-tier-docs";
import { hasFpFitHubAccess, fpTierMatchesDiscoveryFilter } from "@/lib/fp-fithub-access";
import { fpMonthlyPromoteTokenGrant } from "@/lib/fp-promote-tokens";

describe("FP_PERMISSIONS", () => {
  it("defines all four tiers", () => {
    expect(Object.keys(FP_PERMISSIONS)).toHaveLength(4);
    expect(getFpTierPermissions("elite_fitness_pro")?.promote_tokens_monthly).toBe(15);
    expect(getFpTierPermissions("independent_fitness_pro")?.monthly_fee).toBe(15);
  });

  it("premium pro inherits pro with premium badge", () => {
    const premium = getFpTierPermissions("match_fit_premium_pro");
    expect(premium?.badge).toBe("Match Fit Premium Pro");
    expect(premium?.fithub_access).toBe(true);
    expect(premium?.featured_listing).toBe(false);
  });
});

describe("fp tier switching", () => {
  const baseProf = {
    accountTier: "match_fit_pro" as const,
    tierSwitchedAt: new Date("2026-06-01T00:00:00Z"),
    tierSwitchCount: 1,
    pendingTier: null,
    listingStatus: "active",
    backgroundCheckPassed: true,
    billingCycleEnd: null,
    docsApproved: true,
    docsRejectionCount: 0,
    docsLastRejectedAt: null,
  };

  it("blocks switch within 28-day lock", () => {
    const now = new Date("2026-06-15T00:00:00Z");
    expect(fpTierSwitchLockActive(baseProf, now)).toBe(true);
    const result = evaluateFpTierSwitchEligibility(
      baseProf,
      "elite_fitness_pro",
      0,
      now,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("lock_active");
  });

  it("blocks switch with active sessions", () => {
    const now = new Date("2026-07-15T00:00:00Z");
    const result = evaluateFpTierSwitchEligibility(
      baseProf,
      "independent_fitness_pro",
      2,
      now,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("active_sessions");
  });

  it("requires pending_background when switching to elite without BG", () => {
    const status = resolveListingStatusAfterTierSwitch(
      "elite_fitness_pro",
      { backgroundCheckPassed: false, docsApproved: true },
      [{ docType: "professional_certification", status: "approved", fileUrl: "/x" }],
    );
    expect(status).toBe("pending_background");
  });
});

describe("fp docs", () => {
  it("independent tier requires six doc types approved", () => {
    const partial = [
      { docType: "business_registration" as const, status: "approved", fileUrl: "/a" },
    ];
    expect(fpDocsCompleteForTier("independent_fitness_pro", partial)).toBe(false);
  });
});

describe("fp fithub and discovery", () => {
  it("grants fithub when tier set and not suspended", () => {
    expect(
      hasFpFitHubAccess({ accountTier: "match_fit_pro", listingStatus: "active" }),
    ).toBe(true);
    expect(
      hasFpFitHubAccess({ accountTier: "match_fit_pro", listingStatus: "suspended" }),
    ).toBe(false);
  });

  it("filters in-house vs listed businesses", () => {
    expect(fpTierMatchesDiscoveryFilter("match_fit_pro", "in_house")).toBe(true);
    expect(fpTierMatchesDiscoveryFilter("independent_fitness_pro", "in_house")).toBe(false);
    expect(fpTierMatchesDiscoveryFilter("elite_fitness_pro", "listed_businesses")).toBe(true);
  });
});

describe("promote tokens", () => {
  it("grants monthly tokens by tier", () => {
    expect(fpMonthlyPromoteTokenGrant("independent_fitness_pro")).toBe(5);
    expect(fpMonthlyPromoteTokenGrant("elite_fitness_pro")).toBe(15);
    expect(fpMonthlyPromoteTokenGrant("match_fit_pro")).toBe(0);
  });
});

describe("trust labels", () => {
  it("maps trust indicators to labels", () => {
    expect(fpTrustIndicatorLabel("verified_premium")).toBe("Verified Premium");
    expect(fpTrustIndicatorLabel("business_listed")).toBe("Business Listed");
  });
});
