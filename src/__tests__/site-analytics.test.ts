import { describe, expect, it } from "vitest";
import {
  isSiteAnalyticsBotUserAgent,
  parseSiteAnalyticsIngestBody,
} from "@/lib/site-analytics-shared";

describe("site-analytics ingest", () => {
  it("accepts page views on public paths", () => {
    const payload = parseSiteAnalyticsIngestBody({
      kind: "page_view",
      path: "/waitlist/client",
      visitorId: "visitor12345678",
      sessionId: "session12345678",
    });
    expect(payload).toEqual({
      kind: "PAGE_VIEW",
      path: "/waitlist/client",
      targetPath: null,
      targetUrl: null,
      linkLabel: null,
      visitorId: "visitor12345678",
      sessionId: "session12345678",
    });
  });

  it("rejects admin paths and missing link targets", () => {
    expect(
      parseSiteAnalyticsIngestBody({
        kind: "page_view",
        path: "/admin/login",
        visitorId: "visitor12345678",
        sessionId: "session12345678",
      }),
    ).toBeNull();

    expect(
      parseSiteAnalyticsIngestBody({
        kind: "link_click",
        path: "/",
        visitorId: "visitor12345678",
        sessionId: "session12345678",
      }),
    ).toBeNull();
  });

  it("accepts link clicks with internal or external targets", () => {
    expect(
      parseSiteAnalyticsIngestBody({
        kind: "link_click",
        path: "/",
        targetPath: "/trainer/signup",
        linkLabel: "Become a coach",
        visitorId: "visitor12345678",
        sessionId: "session12345678",
      }),
    ).toMatchObject({
      kind: "LINK_CLICK",
      targetPath: "/trainer/signup",
      linkLabel: "Become a coach",
    });

    expect(
      parseSiteAnalyticsIngestBody({
        kind: "link_click",
        path: "/",
        targetUrl: "https://instagram.com/matchfit",
        visitorId: "visitor12345678",
        sessionId: "session12345678",
      }),
    ).toMatchObject({
      targetUrl: "https://instagram.com/matchfit",
    });
  });
});

describe("isSiteAnalyticsBotUserAgent", () => {
  it("flags common crawlers", () => {
    expect(isSiteAnalyticsBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isSiteAnalyticsBotUserAgent("Mozilla/5.0 Chrome/120")).toBe(false);
  });
});
