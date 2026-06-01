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
  userCounts: { trainersTotal: 7, trainersActive: 5, clientsTotal: 12, clientsActive: 10 },
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
    topPages: [],
    topLinks: [],
    daily: [],
    recentEvents: [],
  },
  recentSignups: [],
  recentFeatured: [],
  funnel: {
    homepageVisits: 0,
    totalSiteVisits: 0,
    clientSignupPageViews: 0,
    clientsReachedSignupWithoutAccount: 0,
    trainerSignupPageViews: 0,
    trainersReachedSignupWithoutAccount: 0,
    activeOnSiteNow: 0,
    clientLoginsByRecency: { h12: 0, h24: 0, d7: 0, d30: 0, d90: 0, d180: 0, d365: 0 },
    trainerLoginsByRecency: { h12: 0, h24: 0, d7: 0, d30: 0, d90: 0, d180: 0, d365: 0 },
    pendingClientRegistrations: { total: 0, byStatus: {} },
    incompleteTrainerSignups: 0,
    trainersSignupBeforeBackgroundCheck: 0,
    clientsInFreeTrial: 0,
    activeClientSubscriptions: 0,
    topClientFunctions: [],
    topTrainerFunctions: [],
    analyticsAvailable: false,
  },
  pipeline: { totalInPipeline: 0, stages: [] },
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
  platformSummary: {
    userCounts: { trainersTotal: 0, trainersActive: 0, clientsTotal: 0, clientsActive: 0 },
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
      },
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
        visitorInsight=""
      />,
    );

    expect(html).toContain(`Version ${MATCH_FIT_PRODUCT_VERSION_LABEL}`);
  });
});
