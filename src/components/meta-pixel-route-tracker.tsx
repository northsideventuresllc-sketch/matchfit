"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { resolveSignupFunnelFromPath, trackMetaSignupFunnelStep, trackMetaSiteVisit } from "@/lib/meta-pixel-funnel";

/** Records site visits and URL-based signup funnel steps on every navigation (including first load). */
export function MetaPixelRouteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const path = pathname ?? "/";
    trackMetaSiteVisit(path);
    const funnelStep = resolveSignupFunnelFromPath(path);
    if (funnelStep) trackMetaSignupFunnelStep(funnelStep);
  }, [pathname]);

  return null;
}
