import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAdminSession, mockGetAdPerformancePanel, mockRunAdTrackingAi, mockFindMany, mockHydrate } =
  vi.hoisted(() => ({
    mockRequireAdminSession: vi.fn(),
    mockGetAdPerformancePanel: vi.fn(),
    mockRunAdTrackingAi: vi.fn(),
    mockFindMany: vi.fn(),
    mockHydrate: vi.fn(),
  }));

vi.mock("@/lib/require-admin", () => ({
  requireAdminSession: mockRequireAdminSession,
}));

vi.mock("@/lib/ad-platform-performance", () => ({
  getAdPerformancePanel: mockGetAdPerformancePanel,
}));

vi.mock("@/lib/ad-tracking-ai", () => ({
  runAdTrackingAi: mockRunAdTrackingAi,
}));

vi.mock("@/lib/hydrate-platform-env", () => ({
  hydratePlatformEnvFromDatabase: mockHydrate,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adCampaignRegistry: {
      findMany: mockFindMany,
    },
  },
}));

vi.mock("@/lib/prisma-missing-column", () => ({
  isPrismaMissingTableError: () => false,
}));

import { POST } from "@/app/api/admin/ad-tracking/chat/route";

function postJson(body: unknown): Request {
  return new Request("http://localhost/api/admin/ad-tracking/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("ad tracking chat route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHydrate.mockResolvedValue(undefined);
    mockRequireAdminSession.mockResolvedValue({ adminId: "admin_1", testMode: false, rememberMe: true });
    mockGetAdPerformancePanel.mockResolvedValue({
      windowDays: 7,
      integrations: [],
      campaignPerformance: [],
      attribution: [],
      totals: {
        meta: { impressions: 0, clicks: 0, spendCents: 0, conversions: 0 },
        google: { impressions: 0, clicks: 0, spendCents: 0, conversions: 0 },
        tiktok: { impressions: 0, clicks: 0, spendCents: 0, conversions: 0 },
        attributedPageViews: 0,
        attributedSignupViews: 0,
      },
    });
    mockFindMany.mockResolvedValue([]);
    mockRunAdTrackingAi.mockResolvedValue("Here is how your ads are doing.");
  });

  it("rejects unauthenticated requests", async () => {
    mockRequireAdminSession.mockResolvedValue(null);
    const res = await POST(postJson({ message: "How is spend?" }));
    expect(res.status).toBe(401);
  });

  it("rejects an empty message", async () => {
    const res = await POST(postJson({ message: "" }));
    expect(res.status).toBe(400);
  });

  it("returns the copilot reply for a valid message", async () => {
    const res = await POST(postJson({ message: "How is my ad spend doing?" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { reply?: string };
    expect(json.reply).toBe("Here is how your ads are doing.");
    expect(mockRunAdTrackingAi).toHaveBeenCalledWith(
      expect.objectContaining({ userMessage: "How is my ad spend doing?" }),
    );
  });
});
