import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/site-analytics-tracker", () => ({
  SiteAnalyticsTracker: () => <div data-testid="site-analytics-tracker" />,
}));

import { SiteAnalyticsTrackerBoundary } from "@/components/site-analytics-tracker-boundary";

describe("SiteAnalyticsTrackerBoundary", () => {
  it("wraps tracker render in a suspense boundary with a null fallback", () => {
    const html = renderToStaticMarkup(<SiteAnalyticsTrackerBoundary />);

    expect(html).toContain('data-testid="site-analytics-tracker"');
  });
});
