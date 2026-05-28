import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  clientFindUniqueMock,
  trainerClientConversationFindManyMock,
  getFeaturedTrainersForHomepageMock,
  clientZipToPrefixMock,
  parseClientDashboardQuickLinkIdsJsonMock,
  getSessionClientIdMock,
  isTrainerComplianceCompleteMock,
  isPrismaMissingColumnErrorMock,
  isPrismaUnknownModelFieldErrorMock,
  redirectMock,
} = vi.hoisted(() => ({
  clientFindUniqueMock: vi.fn(),
  trainerClientConversationFindManyMock: vi.fn(),
  getFeaturedTrainersForHomepageMock: vi.fn(),
  clientZipToPrefixMock: vi.fn(),
  parseClientDashboardQuickLinkIdsJsonMock: vi.fn(),
  getSessionClientIdMock: vi.fn(),
  isTrainerComplianceCompleteMock: vi.fn(),
  isPrismaMissingColumnErrorMock: vi.fn(),
  isPrismaUnknownModelFieldErrorMock: vi.fn(),
  redirectMock: vi.fn(),
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
  redirect: redirectMock,
}));

vi.mock("@/components/client/client-dashboard-logout-button", () => ({
  ClientDashboardLogoutButton: () => <div data-component="logout-button" />,
}));

vi.mock("@/components/client/client-dashboard-quick-actions", () => ({
  ClientDashboardQuickActions: ({ quickLinkIds }: { quickLinkIds: string[] }) => (
    <div data-component="quick-actions">{quickLinkIds.join(",")}</div>
  ),
}));

vi.mock("@/lib/featured-homepage-data", () => ({
  getFeaturedTrainersForHomepage: getFeaturedTrainersForHomepageMock,
}));

vi.mock("@/lib/featured-region", () => ({
  clientZipToPrefix: clientZipToPrefixMock,
}));

vi.mock("@/lib/client-dashboard-quick-links", () => ({
  parseClientDashboardQuickLinkIdsJson: parseClientDashboardQuickLinkIdsJsonMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      findUnique: clientFindUniqueMock,
    },
    trainerClientConversation: {
      findMany: trainerClientConversationFindManyMock,
    },
  },
}));

vi.mock("@/lib/prisma-missing-column", () => ({
  isPrismaMissingColumnError: isPrismaMissingColumnErrorMock,
  isPrismaUnknownModelFieldError: isPrismaUnknownModelFieldErrorMock,
}));

vi.mock("@/lib/stale-session-invalidate-url", () => ({
  staleClientSessionInvalidateRedirect: vi.fn((path: string) => `${path}?stale=1`),
}));

vi.mock("@/lib/session", () => ({
  getSessionClientId: getSessionClientIdMock,
}));

vi.mock("@/lib/trainer-compliance-complete", () => ({
  isTrainerComplianceComplete: isTrainerComplianceCompleteMock,
}));

import ClientDashboardHomePage from "@/app/client/dashboard/(app)/page";

function arrangeClientLookups() {
  clientFindUniqueMock
    .mockResolvedValueOnce({ dashboardQuickLinkIdsJson: "[\"messages\"]" })
    .mockResolvedValueOnce({
      preferredName: "Ari",
      username: "ari-client",
      bio: "Client bio",
      zipCode: "30324",
      trainerNudges: [],
    });
}

describe("client dashboard home page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionClientIdMock.mockResolvedValue("client-1");
    clientZipToPrefixMock.mockReturnValue("303");
    parseClientDashboardQuickLinkIdsJsonMock.mockReturnValue(["messages"]);
    trainerClientConversationFindManyMock.mockResolvedValue([]);
    getFeaturedTrainersForHomepageMock.mockResolvedValue([]);
    isTrainerComplianceCompleteMock.mockReturnValue(true);
    isPrismaMissingColumnErrorMock.mockReturnValue(false);
    isPrismaUnknownModelFieldErrorMock.mockReturnValue(false);
    redirectMock.mockImplementation((to: string) => {
      throw new Error(`REDIRECT:${to}`);
    });
  });

  it("hides the featured coaches section when no featured trainers are returned", async () => {
    arrangeClientLookups();

    const markup = await ClientDashboardHomePage();
    const html = renderToStaticMarkup(markup);

    expect(html).toContain("Quick Actions");
    expect(html).toContain("Recent Matches");
    expect(html).toContain("Coach Nudges");
    expect(html).not.toContain("Featured Coaches in Your Area");
    expect(getFeaturedTrainersForHomepageMock).toHaveBeenCalledWith({ zipInput: "30324" });
  });

  it("renders the featured coaches section when featured trainers are available", async () => {
    arrangeClientLookups();
    getFeaturedTrainersForHomepageMock.mockResolvedValueOnce([
      {
        username: "coach-one",
        displayName: "Coach One",
        specialtyLine: "Strength",
        profileImageUrl: null,
        source: "RAFFLE",
      },
    ]);

    const markup = await ClientDashboardHomePage();
    const html = renderToStaticMarkup(markup);

    expect(html).toContain("Featured Coaches in Your Area");
    expect(html).toContain("Browse all coaches");
    expect(html).toContain('href="/trainers/coach-one"');
  });

  it("continues rendering when quick-link column lookups are unavailable", async () => {
    clientFindUniqueMock
      .mockRejectedValueOnce(new Error("missing dashboardQuickLinkIdsJson"))
      .mockResolvedValueOnce({
        preferredName: "Ari",
        username: "ari-client",
        bio: "Client bio",
        zipCode: "30324",
        trainerNudges: [],
      });
    isPrismaMissingColumnErrorMock.mockReturnValue(true);

    const markup = await ClientDashboardHomePage();
    const html = renderToStaticMarkup(markup);

    expect(html).toContain("Quick Actions");
    expect(parseClientDashboardQuickLinkIdsJsonMock).not.toHaveBeenCalled();
    expect(getFeaturedTrainersForHomepageMock).toHaveBeenCalledWith({ zipInput: "30324" });
  });
});
