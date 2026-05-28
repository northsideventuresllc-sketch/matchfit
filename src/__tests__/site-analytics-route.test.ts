import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  isBotUserAgentMock,
  parseIngestBodyMock,
  recordSiteAnalyticsEventMock,
  getRequestClientIpMock,
  simpleRateLimitAllowMock,
} = vi.hoisted(() => ({
  isBotUserAgentMock: vi.fn(),
  parseIngestBodyMock: vi.fn(),
  recordSiteAnalyticsEventMock: vi.fn(),
  getRequestClientIpMock: vi.fn(),
  simpleRateLimitAllowMock: vi.fn(),
}));

vi.mock("@/lib/site-analytics", () => ({
  isSiteAnalyticsBotUserAgent: isBotUserAgentMock,
  parseSiteAnalyticsIngestBody: parseIngestBodyMock,
  recordSiteAnalyticsEvent: recordSiteAnalyticsEventMock,
}));

vi.mock("@/lib/request-client-ip", () => ({
  getRequestClientIp: getRequestClientIpMock,
}));

vi.mock("@/lib/simple-rate-limit", () => ({
  simpleRateLimitAllow: simpleRateLimitAllowMock,
}));

import { POST } from "@/app/api/public/site-analytics/route";

function makeRequest(body: unknown, userAgent = "Mozilla/5.0 Chrome/120"): Request {
  return new Request("https://matchfit.test/api/public/site-analytics", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": userAgent,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/public/site-analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestClientIpMock.mockReturnValue("127.0.0.1");
    simpleRateLimitAllowMock.mockReturnValue(true);
    isBotUserAgentMock.mockReturnValue(false);
    parseIngestBodyMock.mockReturnValue({
      kind: "PAGE_VIEW",
      path: "/",
      targetPath: null,
      targetUrl: null,
      linkLabel: null,
      visitorId: "visitor12345",
      sessionId: "session12345",
    });
    recordSiteAnalyticsEventMock.mockResolvedValue(undefined);
  });

  it("returns 429 when the IP exceeds the rate limit", async () => {
    simpleRateLimitAllowMock.mockReturnValueOnce(false);

    const response = await POST(makeRequest({ kind: "page_view" }));

    expect(response.status).toBe(429);
    expect(isBotUserAgentMock).not.toHaveBeenCalled();
    expect(parseIngestBodyMock).not.toHaveBeenCalled();
    expect(recordSiteAnalyticsEventMock).not.toHaveBeenCalled();
  });

  it("returns 204 and skips ingest when request user-agent is a bot", async () => {
    isBotUserAgentMock.mockReturnValueOnce(true);

    const response = await POST(makeRequest({ kind: "page_view" }, "Googlebot/2.1"));

    expect(response.status).toBe(204);
    expect(parseIngestBodyMock).not.toHaveBeenCalled();
    expect(recordSiteAnalyticsEventMock).not.toHaveBeenCalled();
  });

  it("returns 400 when payload parsing fails", async () => {
    parseIngestBodyMock.mockReturnValueOnce(null);

    const response = await POST(makeRequest({ kind: "invalid" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid payload." });
    expect(recordSiteAnalyticsEventMock).not.toHaveBeenCalled();
  });

  it("records valid payloads and returns 204", async () => {
    const payload = {
      kind: "LINK_CLICK",
      path: "/",
      targetPath: "/trainer/signup",
      targetUrl: null,
      linkLabel: "Become a coach",
      visitorId: "visitor12345",
      sessionId: "session12345",
    };
    parseIngestBodyMock.mockReturnValueOnce(payload);

    const response = await POST(makeRequest(payload));

    expect(simpleRateLimitAllowMock).toHaveBeenCalledWith("site-analytics:127.0.0.1", 180, 900000);
    expect(parseIngestBodyMock).toHaveBeenCalledWith(payload);
    expect(recordSiteAnalyticsEventMock).toHaveBeenCalledWith(payload);
    expect(response.status).toBe(204);
  });

  it("returns 500 when persistence throws unexpectedly", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    recordSiteAnalyticsEventMock.mockRejectedValueOnce(new Error("insert failed"));

    const response = await POST(makeRequest({ kind: "page_view", path: "/" }));

    expect(response.status).toBe(500);
    errorSpy.mockRestore();
  });
});
