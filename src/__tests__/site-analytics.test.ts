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

  it("normalizes kind casing, strips query/hash from paths, and trims labels", () => {
    expect(
      parseSiteAnalyticsIngestBody({
        kind: "link_click",
        path: " /trainer/signup?utm=nav#hero ",
        targetPath: "/client/login?source=home",
        linkLabel: "  Become a coach  ",
        visitorId: "visitor12345678",
        sessionId: "session12345678",
      }),
    ).toEqual({
      kind: "LINK_CLICK",
      path: "/trainer/signup",
      targetPath: "/client/login",
      targetUrl: null,
      linkLabel: "Become a coach",
      visitorId: "visitor12345678",
      sessionId: "session12345678",
    });
  });

  it("rejects malformed identifiers and blocked link targets", () => {
    expect(
      parseSiteAnalyticsIngestBody({
        kind: "page_view",
        path: "/",
        visitorId: "short",
        sessionId: "session12345678",
      }),
    ).toBeNull();

    expect(
      parseSiteAnalyticsIngestBody({
        kind: "link_click",
        path: "/",
        targetPath: "/admin/login",
        visitorId: "visitor12345678",
        sessionId: "session12345678",
      }),
    ).toBeNull();

    expect(
      parseSiteAnalyticsIngestBody({
        kind: "link_click",
        path: "/",
        targetUrl: "ftp://example.com/file",
        visitorId: "visitor12345678",
        sessionId: "session12345678",
      }),
    ).toBeNull();
  });

  it("truncates long labels and external URLs to configured maximum sizes", () => {
    const longLabel = "x".repeat(300);
    const longExternalUrl = `https://example.com/${"a".repeat(700)}`;

    const payload = parseSiteAnalyticsIngestBody({
      kind: "link_click",
      path: "/",
      targetUrl: longExternalUrl,
      linkLabel: longLabel,
      visitorId: "visitor12345678",
      sessionId: "session12345678",
    });

    expect(payload).not.toBeNull();
    expect(payload?.targetUrl?.length).toBe(500);
    expect(payload?.linkLabel?.length).toBe(200);
  });
});

describe("isSiteAnalyticsBotUserAgent", () => {
  it("flags common crawlers", () => {
    expect(isSiteAnalyticsBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isSiteAnalyticsBotUserAgent("Mozilla/5.0 Chrome/120")).toBe(false);
  });
});
