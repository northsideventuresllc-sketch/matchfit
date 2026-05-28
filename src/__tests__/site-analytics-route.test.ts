import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockIsSiteAnalyticsBotUserAgent,
  mockParseSiteAnalyticsIngestBody,
  mockRecordSiteAnalyticsEvent,
  mockGetRequestClientIp,
  mockSimpleRateLimitAllow,
} = vi.hoisted(() => ({
  mockIsSiteAnalyticsBotUserAgent: vi.fn(),
  mockParseSiteAnalyticsIngestBody: vi.fn(),
  mockRecordSiteAnalyticsEvent: vi.fn(),
  mockGetRequestClientIp: vi.fn(),
  mockSimpleRateLimitAllow: vi.fn(),
}));

vi.mock("@/lib/site-analytics", () => ({
  isSiteAnalyticsBotUserAgent: mockIsSiteAnalyticsBotUserAgent,
  parseSiteAnalyticsIngestBody: mockParseSiteAnalyticsIngestBody,
  recordSiteAnalyticsEvent: mockRecordSiteAnalyticsEvent,
}));

vi.mock("@/lib/request-client-ip", () => ({
  getRequestClientIp: mockGetRequestClientIp,
}));

vi.mock("@/lib/simple-rate-limit", () => ({
  simpleRateLimitAllow: mockSimpleRateLimitAllow,
}));

import { POST } from "@/app/api/public/site-analytics/route";

function makeRequest(opts?: {
  body?: string;
  userAgent?: string;
}): Request {
  return new Request("https://example.test/api/public/site-analytics", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(opts?.userAgent ? { "user-agent": opts.userAgent } : {}),
    },
    body: opts?.body ?? JSON.stringify({ kind: "page_view", path: "/" }),
  });
}

describe("POST /api/public/site-analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetRequestClientIp.mockReturnValue("127.0.0.1");
    mockSimpleRateLimitAllow.mockReturnValue(true);
    mockIsSiteAnalyticsBotUserAgent.mockReturnValue(false);
    mockParseSiteAnalyticsIngestBody.mockReturnValue({
      kind: "PAGE_VIEW",
      path: "/",
      targetPath: null,
      targetUrl: null,
      linkLabel: null,
      visitorId: "visitor_1234",
      sessionId: "session_1234",
    });
    mockRecordSiteAnalyticsEvent.mockResolvedValue(undefined);
  });

  it("returns 429 when rate limit denies the request", async () => {
    mockSimpleRateLimitAllow.mockReturnValueOnce(false);

    const response = await POST(makeRequest());

    expect(response.status).toBe(429);
    expect(mockSimpleRateLimitAllow).toHaveBeenCalledWith(
      "site-analytics:127.0.0.1",
      180,
      15 * 60 * 1000,
    );
    expect(mockIsSiteAnalyticsBotUserAgent).not.toHaveBeenCalled();
    expect(mockRecordSiteAnalyticsEvent).not.toHaveBeenCalled();
  });

  it("returns 204 and skips persistence for bot user agents", async () => {
    mockIsSiteAnalyticsBotUserAgent.mockReturnValueOnce(true);

    const response = await POST(makeRequest({ userAgent: "Googlebot/2.1" }));

    expect(response.status).toBe(204);
    expect(mockParseSiteAnalyticsIngestBody).not.toHaveBeenCalled();
    expect(mockRecordSiteAnalyticsEvent).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON bodies", async () => {
    mockParseSiteAnalyticsIngestBody.mockReturnValueOnce(null);

    const response = await POST(makeRequest({ body: "{invalid" }));

    expect(mockParseSiteAnalyticsIngestBody).toHaveBeenCalledWith(null);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid payload." });
    expect(mockRecordSiteAnalyticsEvent).not.toHaveBeenCalled();
  });

  it("returns 400 when parsed payload validation fails", async () => {
    mockParseSiteAnalyticsIngestBody.mockReturnValueOnce(null);

    const response = await POST(makeRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid payload." });
    expect(mockRecordSiteAnalyticsEvent).not.toHaveBeenCalled();
  });

  it("records valid events and returns 204", async () => {
    const payload = {
      kind: "LINK_CLICK",
      path: "/",
      targetPath: "/trainer/signup",
      targetUrl: null,
      linkLabel: "Become a coach",
      visitorId: "visitor_1234",
      sessionId: "session_1234",
    };
    mockParseSiteAnalyticsIngestBody.mockReturnValueOnce(payload);

    const response = await POST(makeRequest());

    expect(response.status).toBe(204);
    expect(mockRecordSiteAnalyticsEvent).toHaveBeenCalledWith(payload);
  });

  it("returns 500 when event recording throws", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockRecordSiteAnalyticsEvent.mockRejectedValueOnce(new Error("db unavailable"));

    const response = await POST(makeRequest());

    expect(response.status).toBe(500);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
