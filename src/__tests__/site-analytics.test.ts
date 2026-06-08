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

  it("normalizes paths and trims labels", () => {
    const payload = parseSiteAnalyticsIngestBody({
      kind: "link_click",
      path: "   /waitlist/client?utm_source=ads#top  ",
      targetPath: "/trainer/signup?ref=footer#cta",
      linkLabel: "  Join as trainer  ",
      visitorId: "visitor12345678",
      sessionId: "session12345678",
    });

    expect(payload).toEqual({
      kind: "LINK_CLICK",
      path: "/waitlist/client",
      targetPath: "/trainer/signup",
      targetUrl: null,
      linkLabel: "Join as trainer",
      visitorId: "visitor12345678",
      sessionId: "session12345678",
    });
  });

  it("rejects invalid IDs and non-http external urls", () => {
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
        targetUrl: "ftp://example.com/invalid",
        visitorId: "visitor12345678",
        sessionId: "session12345678",
      }),
    ).toBeNull();
  });

  it("rejects internal and API target paths for link clicks", () => {
    expect(
      parseSiteAnalyticsIngestBody({
        kind: "link_click",
        path: "/",
        targetPath: "/admin/users",
        visitorId: "visitor12345678",
        sessionId: "session12345678",
      }),
    ).toBeNull();

    expect(
      parseSiteAnalyticsIngestBody({
        kind: "link_click",
        path: "/",
        targetPath: "/api/public/site-analytics",
        visitorId: "visitor12345678",
        sessionId: "session12345678",
      }),
    ).toBeNull();
  });

  it("accepts form submit events with form id label", () => {
    expect(
      parseSiteAnalyticsIngestBody({
        kind: "form_submit_attempt",
        path: "/client/sign-up",
        linkLabel: "client_sign_up",
        visitorId: "visitor12345678",
        sessionId: "session12345678",
      }),
    ).toMatchObject({
      kind: "FORM_SUBMIT_ATTEMPT",
      linkLabel: "client_sign_up",
    });

    expect(
      parseSiteAnalyticsIngestBody({
        kind: "form_field_focus",
        path: "/client/sign-up",
        visitorId: "visitor12345678",
        sessionId: "session12345678",
      }),
    ).toBeNull();
  });

  it("truncates long values to storage-safe lengths", () => {
    const payload = parseSiteAnalyticsIngestBody({
      kind: "link_click",
      path: `/${"a".repeat(550)}`,
      targetUrl: `https://example.com/${"x".repeat(600)}`,
      linkLabel: "L".repeat(260),
      visitorId: "visitor12345678",
      sessionId: "session12345678",
    });

    expect(payload?.path.length).toBe(500);
    expect(payload?.targetUrl?.length).toBe(500);
    expect(payload?.linkLabel?.length).toBe(200);
  });
});

describe("isSiteAnalyticsBotUserAgent", () => {
  it("flags common crawlers", () => {
    expect(isSiteAnalyticsBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isSiteAnalyticsBotUserAgent("Mozilla/5.0 Chrome/120")).toBe(false);
  });

  it("returns false for blank or missing user-agent values", () => {
    expect(isSiteAnalyticsBotUserAgent(null)).toBe(false);
    expect(isSiteAnalyticsBotUserAgent("   ")).toBe(false);
  });
});
