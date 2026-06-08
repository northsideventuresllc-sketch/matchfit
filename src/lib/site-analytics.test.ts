import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSiteAnalyticsCreate, mockQueryRaw, mockIsPrismaMissingTableError } = vi.hoisted(() => ({
  mockSiteAnalyticsCreate: vi.fn(),
  mockQueryRaw: vi.fn(),
  mockIsPrismaMissingTableError: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    siteAnalyticsEvent: {
      create: mockSiteAnalyticsCreate,
    },
    $queryRaw: mockQueryRaw,
  },
}));

vi.mock("@/lib/prisma-missing-column", () => ({
  isPrismaMissingTableError: mockIsPrismaMissingTableError,
}));

import { getAdminSiteTrafficSnapshot, recordSiteAnalyticsEvent } from "@/lib/site-analytics";

describe("site-analytics server helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSiteAnalyticsCreate.mockResolvedValue(undefined);
    mockQueryRaw.mockResolvedValue([]);
    mockIsPrismaMissingTableError.mockReturnValue(false);
  });

  it("persists normalized analytics payload fields", async () => {
    await recordSiteAnalyticsEvent({
      kind: "LINK_CLICK",
      path: "/",
      targetPath: "/trainer/signup",
      targetUrl: null,
      linkLabel: null,
      visitorId: "visitor_abc12345",
      sessionId: "session_abc12345",
    });

    expect(mockSiteAnalyticsCreate).toHaveBeenCalledWith({
      data: {
        kind: "LINK_CLICK",
        path: "/",
        targetPath: "/trainer/signup",
        targetUrl: null,
        linkLabel: null,
        visitorId: "visitor_abc12345",
        sessionId: "session_abc12345",
      },
    });
  });

  it("maps aggregate query rows into an admin traffic snapshot", async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ n: BigInt(42) }])
      .mockResolvedValueOnce([{ n: BigInt(19) }])
      .mockResolvedValueOnce([{ n: BigInt(8) }])
      .mockResolvedValueOnce([{ n: BigInt(3) }])
      .mockResolvedValueOnce([{ n: BigInt(2) }])
      .mockResolvedValueOnce([{ n: BigInt(1) }])
      .mockResolvedValueOnce([{ n: BigInt(4) }])
      .mockResolvedValueOnce([{ path: "/waitlist/client", views: BigInt(12) }])
      .mockResolvedValueOnce([{ target: "/trainer/signup", label: "Become a coach", clicks: BigInt(5) }])
      .mockResolvedValueOnce([{ day_key: "2026-05-26", page_views: BigInt(7), unique_visitors: BigInt(6) }])
      .mockResolvedValueOnce([
        {
          created_at: new Date("2026-05-27T18:00:00.000Z"),
          kind: "LINK_CLICK",
          path: "/",
          target_path: "/trainer/signup",
          target_url: null,
          link_label: "Become a coach",
        },
      ]);

    const snapshot = await getAdminSiteTrafficSnapshot(45);

    expect(snapshot).toEqual({
      windowDays: 30,
      pageViews: 42,
      uniqueVisitors: 19,
      linkClicks: 8,
      formEvents: {
        fieldFocus: 3,
        submitAttempts: 2,
        submitErrors: 1,
        submitSuccesses: 4,
      },
      topPages: [{ path: "/waitlist/client", views: 12 }],
      topLinks: [{ target: "/trainer/signup", label: "Become a coach", clicks: 5 }],
      daily: [{ dayKey: "2026-05-26", pageViews: 7, uniqueVisitors: 6 }],
      recentEvents: [
        {
          at: "2026-05-27T18:00:00.000Z",
          kind: "LINK_CLICK",
          path: "/",
          target: "/trainer/signup",
          label: "Become a coach",
        },
      ],
    });
    expect(mockQueryRaw).toHaveBeenCalledTimes(11);
  });

  it("returns an empty snapshot when the analytics table is missing", async () => {
    const err = new Error("missing table");
    mockQueryRaw.mockRejectedValueOnce(err);
    mockIsPrismaMissingTableError.mockReturnValueOnce(true);

    await expect(getAdminSiteTrafficSnapshot(0)).resolves.toEqual({
      windowDays: 1,
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
    });
    expect(mockIsPrismaMissingTableError).toHaveBeenCalledWith(err, "site_analytics_events");
  });

  it("rethrows unknown analytics query failures", async () => {
    const err = new Error("database unavailable");
    mockQueryRaw.mockRejectedValueOnce(err);
    mockIsPrismaMissingTableError.mockReturnValueOnce(false);

    await expect(getAdminSiteTrafficSnapshot(7)).rejects.toBe(err);
  });
});
