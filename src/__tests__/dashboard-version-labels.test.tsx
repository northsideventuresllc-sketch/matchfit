import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { usePathnameMock } = vi.hoisted(() => ({
  usePathnameMock: vi.fn<(typeof import("next/navigation"))["usePathname"]>(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: unknown;
    children: ReactNode;
  } & Record<string, unknown>) => <a href={typeof href === "string" ? href : String(href)} {...props}>{children}</a>,
}));

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
}));

vi.mock("@/components/client/client-dashboard-app-header", () => ({
  ClientDashboardAppHeader: () => <div data-component="client-dashboard-app-header" />,
}));

vi.mock("@/components/client/client-diy-governance-gate", () => ({
  ClientDiyGovernanceGateBanner: () => <div data-component="client-diy-governance-gate-banner" />,
}));

vi.mock("@/components/trainer/trainer-dashboard-app-header", () => ({
  TrainerDashboardAppHeader: () => <div data-component="trainer-dashboard-app-header" />,
}));

vi.mock("@/components/turnstile-widget", () => ({
  TurnstileWidget: () => <div data-component="turnstile-widget" />,
}));

vi.mock("@/lib/navigate-full-load", () => ({
  navigateWithFullLoad: vi.fn(),
}));

import { AdminDashboardClient } from "@/app/admin/admin-dashboard-client";
import { ClientDashboardShell } from "@/components/client/client-dashboard-shell";
import { TrainerDashboardShell } from "@/components/trainer/trainer-dashboard-shell";
import { DEFAULT_ADMIN_DASHBOARD_LAYOUT } from "@/lib/admin-dashboard-layout";
import type { AdminPortalOverview } from "@/lib/admin-portal-types";
import { MATCH_FIT_PRODUCT_VERSION_LABEL } from "@/lib/match-fit-product-version";

const EMPTY_OVERVIEW: AdminPortalOverview = {
  computedAt: "2026-06-05T12:00:00.000Z",
  userCounts: { trainersTotal: 7, trainersPending: 1, trainersActive: 5, clientsTotal: 12, clientsActive: 10 },
  revenue: {
    revenueCents: 0,
    grossProfitCents: 0,
    eventCount: 0,
    byCategory: {
      SERVICE_CHECKOUT: { revenueCents: 0, grossProfitCents: 0, eventCount: 0 },
      CLIENT_PLATFORM_SUBSCRIPTION: { revenueCents: 0, grossProfitCents: 0, eventCount: 0 },
      TRAINER_PREMIUM_SUBSCRIPTION: { revenueCents: 0, grossProfitCents: 0, eventCount: 0 },
      ONE_TIME_PURCHASE: { revenueCents: 0, grossProfitCents: 0, eventCount: 0 },
    },
    activePlatformSubscribers: 0,
    activeTrainerPremiumSubscribers: 0,
  },
  traffic: {
    windowDays: 7,
    pageViews: 0,
    uniqueVisitors: 0,
    linkClicks: 0,
    formEvents: {
      fieldFocus: 0,
      submitAttempts: 0,
      submitErrors: 0,
      submitSuccesses: 0,
    },
    topPages: [],
    topLinks: [],
    daily: [],
    recentEvents: [],
  },
  memberOverview: {
    allMembersTotal: 0,
    vipTrialClients: 0,
    subscribedClients: 0,
    inactiveClients: 0,
    freePlanClients: 0,
    activeVipClients: 0,
    uniqueSiteVisitorsAllTime: 0,
    pendingTrainers: 0,
    compliantActiveTrainers: 0,
    inactiveTrainers: 0,
  },
  recentFeatured: [],
  siteActivity: {
    activeMembersNow: 0,
    clientLoginsByRecency: { h12: 0, h24: 0, d7: 0, d30: 0, d90: 0, d180: 0, d365: 0 },
    trainerLoginsByRecency: { h12: 0, h24: 0, d7: 0, d30: 0, d90: 0, d180: 0, d365: 0 },
    topClientFunctions: [],
    topTrainerFunctions: [],
  },
  adPerformance: {
    windowDays: 7,
    totals: {
      meta: { spendCents: 0, clicks: 0, impressions: 0 },
      google: { spendCents: 0, clicks: 0, impressions: 0 },
      attributedPageViews: 0,
      attributedSignupViews: 0,
    },
    integrations: [],
    attribution: [],
  },
  clientPipeline: { stages: [], entries: [] },
  pipeline: { totalInPipeline: 0, stages: [], pendingTrainers: [] },
  premiumActivity: {
    premiumTrainers: 0,
    featuredSlotsToday: 0,
    activeAdvertisements: 0,
    tokenRevenueCents: 0,
    recentBids: [],
  },
  emailStats: {
    windowDays: 7,
    totalAttempts: 0,
    sent: 0,
    skippedPrefs: 0,
    skippedNoRecipient: 0,
    failed: 0,
    byKind: [],
    recent: [],
  },
  finances: {
    windows: {
      "24h": { revenueCents: 0, grossProfitCents: 0, byCategory: {}, platformFeesCents: 0, leadingRevenueFactor: null },
      "7d": { revenueCents: 0, grossProfitCents: 0, byCategory: {}, platformFeesCents: 0, leadingRevenueFactor: null },
      "30d": { revenueCents: 0, grossProfitCents: 0, byCategory: {}, platformFeesCents: 0, leadingRevenueFactor: null },
      "90d": { revenueCents: 0, grossProfitCents: 0, byCategory: {}, platformFeesCents: 0, leadingRevenueFactor: null },
      "1y": { revenueCents: 0, grossProfitCents: 0, byCategory: {}, platformFeesCents: 0, leadingRevenueFactor: null },
      "5y": { revenueCents: 0, grossProfitCents: 0, byCategory: {}, platformFeesCents: 0, leadingRevenueFactor: null },
    },
    lifetime: { revenueCents: 0, grossProfitCents: 0, byCategory: {}, platformFeesCents: 0, leadingRevenueFactor: null, eventCount: 0 },
    clientsInFreeTrial: 0,
    clientsInPlatformTrial: 0,
    clientsInStripeTrial: 0,
    clientsInPlatformPaymentGrace: 0,
    pendingSubscriptionStop: null,
    paymentFailedInGrace: 0,
    clientsWithCard: 0,
    activeSubscriptions: 0,
    recentTransactions: [],
    premiumTrainers: 0,
    trainersWithCard: null,
    featuredTrainersToday: 0,
    bestSellers: [],
  },
  alerts: { groups: [] },
  backgroundChecks: {
    platformMode: "plan_b",
    planBActive: true,
    awaitingManualInvite: [],
    automatedInvitesSent: [],
    manualInvitesSent: [],
    planAPending: [],
    activeEntries: [],
    summary: {
      awaitingManualInvite: 0,
      automatedInvitesSent: 0,
      manualInvitesSent: 0,
      planAPending: 0,
      screeningInProgress: 0,
      failed: 0,
    },
  },
  platformSummary: {
    userCounts: { trainersTotal: 0, trainersPending: 0, trainersActive: 0, clientsTotal: 0, clientsActive: 0 },
    stabilityScore: 0,
    stabilityNotes: [],
    securityScore: 0,
    securityNotes: [],
    lifetimeRevenueCents: 0,
    lifetimeGrossProfitCents: 0,
    successRating: {
      score: 0,
      factors: [],
      meta: {
        launchDate: "2026-05-21",
        marketingStartDate: "2026-05-25",
        marketingBudgetUsd: 70,
        daysSinceLaunch: 0,
        performanceMetricsActive: false,
        performanceGraceDaysRemaining: 90,
      },
    },
    valuation: {
      valuationCents: 0,
      subscriptionArrCents: 0,
      transactionalArrCents: 0,
      totalArrCents: 0,
      revenueMultiple: 3,
      networkValueCents: 0,
      method: "Beta marketplace heuristic",
    },
    potentialRating: {
      scoreLow: 0,
      scoreHigh: 0,
      currentScore: 0,
      scenarios: [],
      optimizedFactors: [],
      recommendations: [],
      assumptions: [],
      meta: {
        launchDate: "2026-05-21",
        marketingStartDate: "2026-05-25",
        marketingBudgetUsd: 70,
        daysSinceLaunch: 0,
        performanceMetricsActive: false,
        performanceGraceDaysRemaining: 90,
      },
    },
    growthProjection: {
      realisticMonthlyRevenueCents: 0,
      realisticMonthlyGrossProfitCents: 0,
      recurringMrrCents: 0,
      valuationLowCents: 0,
      valuationMidCents: 0,
      valuationHighCents: 0,
      assumptions: [],
      revenueRecommendations: [],
    },
  },
};

describe("dashboard version labels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePathnameMock.mockReturnValue("/client/dashboard");
  });

  it("renders product version in the client dashboard footer", () => {
    const html = renderToStaticMarkup(
      <ClientDashboardShell preferredName="Casey" profileImageUrl={null} initialUnreadCount={0}>
        <div>Client content</div>
      </ClientDashboardShell>,
    );

    expect(html).toContain(`Version ${MATCH_FIT_PRODUCT_VERSION_LABEL}`);
  });

  it("renders product version in the trainer dashboard footer", () => {
    usePathnameMock.mockReturnValue("/trainer/dashboard");

    const html = renderToStaticMarkup(
      <TrainerDashboardShell
        displayName="Jordan"
        profileImageUrl={null}
        initialUnreadCount={0}
        premiumStudioActive={false}
      >
        <div>Trainer content</div>
      </TrainerDashboardShell>,
    );

    expect(html).toContain(`Version ${MATCH_FIT_PRODUCT_VERSION_LABEL}`);
  });

  it("renders product version in the admin portal header", () => {
    const html = renderToStaticMarkup(
      <AdminDashboardClient
        initialOverview={EMPTY_OVERVIEW}
        initialTestMode={false}
        initialLayout={DEFAULT_ADMIN_DASHBOARD_LAYOUT}
        administratorId="admin_test"
        layoutLoadedFromServer={false}
        auditLog={[]}
      />,
    );

    expect(html).toContain(`v${MATCH_FIT_PRODUCT_VERSION_LABEL}`);
  });
});
