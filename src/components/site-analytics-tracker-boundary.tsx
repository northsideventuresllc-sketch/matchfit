"use client";

import { Suspense } from "react";
import { SiteAnalyticsTracker } from "@/components/site-analytics-tracker";

/** Wraps {@link SiteAnalyticsTracker} so `useSearchParams` satisfies Next.js static rules. */
export function SiteAnalyticsTrackerBoundary() {
  return (
    <Suspense fallback={null}>
      <SiteAnalyticsTracker />
    </Suspense>
  );
}
