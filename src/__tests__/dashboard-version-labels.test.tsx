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
import { DEFAULT_ADMIN_DASHBOARD_WIDGETS } from "@/lib/admin-dashboard-widgets";
import { MATCH_FIT_PRODUCT_VERSION_LABEL } from "@/lib/match-fit-product-version";

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
        initialOverview={{
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
            uniqueVisitors: 0,
            pageViews: 0,
            windowDays: 30,
            topPages: [],
            topLinks: [],
          },
          recentSignups: [],
          recentFeatured: [],
        }}
        initialTestMode={false}
        enabledWidgets={[...DEFAULT_ADMIN_DASHBOARD_WIDGETS]}
        auditLog={[]}
        visitorInsight=""
      />,
    );

    expect(html).toContain(`Version ${MATCH_FIT_PRODUCT_VERSION_LABEL}`);
  });
});
