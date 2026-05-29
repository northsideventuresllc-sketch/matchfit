import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/font/google", () => ({
  Geist: vi.fn(() => ({ variable: "font-geist-sans" })),
  Geist_Mono: vi.fn(() => ({ variable: "font-geist-mono" })),
}));

vi.mock("@vercel/analytics/next", () => ({
  Analytics: () => <div data-component="vercel-analytics" />,
}));

vi.mock("@/components/dev-account-shortcuts", () => ({
  DevAccountShortcuts: () => <div data-component="dev-account-shortcuts" />,
}));

vi.mock("@/components/google-ads-gtag", () => ({
  GoogleAdsGtag: () => <div data-component="google-ads-gtag" />,
}));

vi.mock("@/components/site-analytics-tracker-boundary", () => ({
  SiteAnalyticsTrackerBoundary: () => <div data-component="site-analytics-tracker-boundary" />,
}));

import RootLayout from "@/app/layout";

const originalEnv = { ...process.env };

describe("app/layout RootLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("renders shared analytics components and page content in order", () => {
    process.env.NODE_ENV = "production";

    const html = renderToStaticMarkup(
      <RootLayout>
        <main data-component="page-content">Page content</main>
      </RootLayout>,
    );

    expect(html).toContain('lang="en"');
    expect(html).toContain("font-geist-sans");
    expect(html).toContain("font-geist-mono");
    expect(html).toContain('data-component="google-ads-gtag"');
    expect(html).toContain('data-component="site-analytics-tracker-boundary"');
    expect(html).toContain('data-component="page-content"');
    expect(html).toContain('data-component="vercel-analytics"');

    expect(html.indexOf('data-component="google-ads-gtag"')).toBeLessThan(
      html.indexOf('data-component="site-analytics-tracker-boundary"'),
    );
    expect(html.indexOf('data-component="site-analytics-tracker-boundary"')).toBeLessThan(
      html.indexOf('data-component="page-content"'),
    );
    expect(html.indexOf('data-component="page-content"')).toBeLessThan(
      html.indexOf('data-component="vercel-analytics"'),
    );
  });

  it("renders dev account shortcuts only in development", () => {
    process.env.NODE_ENV = "development";

    const developmentHtml = renderToStaticMarkup(
      <RootLayout>
        <div />
      </RootLayout>,
    );
    expect(developmentHtml).toContain('data-component="dev-account-shortcuts"');

    process.env.NODE_ENV = "production";
    const productionHtml = renderToStaticMarkup(
      <RootLayout>
        <div />
      </RootLayout>,
    );
    expect(productionHtml).not.toContain('data-component="dev-account-shortcuts"');
  });
});
