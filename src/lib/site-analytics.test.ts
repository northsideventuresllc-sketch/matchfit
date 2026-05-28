import { beforeEach, describe, expect, it, vi } from "vitest";

const { siteAnalyticsCreateMock, queryRawMock } = vi.hoisted(() => ({
  siteAnalyticsCreateMock: vi.fn(),
  queryRawMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    siteAnalyticsEvent: {
      create: siteAnalyticsCreateMock,
    },
    $queryRaw: queryRawMock,
  },
}));

import { getAdminSiteTrafficSnapshot, recordSiteAnalyticsEvent } from "@/lib/site-analytics";

describe("site-analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    siteAnalyticsCreateMock.mockResolvedValue({});
  });

  it("persists normalized optional fields as nullable Prisma columns", async () => {
    await recordSiteAnalyticsEvent({
      kind: "PAGE_VIEW",
      path: "/waitlist/client",
      targetPath: undefined,
      targetUrl: undefined,
      linkLabel: undefined,
      visitorId: "visitor12345",
      sessionId: "session12345",
    });

    expect(siteAnalyticsCreateMock).toHaveBeenCalledWith({
      data: {
        kind: "PAGE_VIEW",
        path: "/waitlist/client",
        targetPath: null,
        targetUrl: null,
        linkLabel: null,
        visitorId: "visitor12345",
        sessionId: "session12345",
      },
    });
  });

  it("maps aggregate query rows into an admin traffic snapshot", async () => {
    queryRawMock
      .mockResolvedValueOnce([{ n: 7n }])
      .mockResolvedValueOnce([{ n: 5n }])
      .mockResolvedValueOnce([{ n: 3n }])
      .mockResolvedValueOnce([{ path: "/waitlist/client", views: 4n }])
      .mockResolvedValueOnce([{ target: "/trainer/signup", label: "Become a coach", clicks: 2n }])
      .mockResolvedValueOnce([{ day_key: "2026-05-27", page_views: 4n, unique_visitors: 3n }])
      .mockResolvedValueOnce([
        {
          created_at: new Date("2026-05-28T08:30:00.000Z"),
          kind: "PAGE_VIEW",
          path: "/waitlist/client",
          target_path: null,
          target_url: null,
          link_label: null,
        },
        {
          created_at: new Date("2026-05-28T08:31:00.000Z"),
          kind: "LINK_CLICK",
          path: "/",
          target_path: null,
          target_url: "https://instagram.com/matchfit",
          link_label: "Instagram",
        },
      ]);

    await expect(getAdminSiteTrafficSnapshot(99.9)).resolves.toEqual({
      windowDays: 30,
      pageViews: 7,
      uniqueVisitors: 5,
      linkClicks: 3,
      topPages: [{ path: "/waitlist/client", views: 4 }],
      topLinks: [{ target: "/trainer/signup", label: "Become a coach", clicks: 2 }],
      daily: [{ dayKey: "2026-05-27", pageViews: 4, uniqueVisitors: 3 }],
      recentEvents: [
        {
          at: "2026-05-28T08:30:00.000Z",
          kind: "PAGE_VIEW",
          path: "/waitlist/client",
          target: null,
          label: null,
        },
        {
          at: "2026-05-28T08:31:00.000Z",
          kind: "LINK_CLICK",
          path: "/",
          target: "https://instagram.com/matchfit",
          label: "Instagram",
        },
      ],
    });
    expect(queryRawMock).toHaveBeenCalledTimes(7);
  });

  it("returns an empty snapshot when analytics table is missing", async () => {
    queryRawMock.mockRejectedValueOnce(
      new Error('relation "site_analytics_events" does not exist (SQLSTATE 42P01)'),
    );

    await expect(getAdminSiteTrafficSnapshot(0)).resolves.toEqual({
      windowDays: 1,
      pageViews: 0,
      uniqueVisitors: 0,
      linkClicks: 0,
      topPages: [],
      topLinks: [],
      daily: [],
      recentEvents: [],
    });
  });

  it("rethrows unexpected query failures", async () => {
    queryRawMock.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(getAdminSiteTrafficSnapshot(7)).rejects.toThrow("database unavailable");
  });
});
