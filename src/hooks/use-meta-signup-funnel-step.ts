"use client";

import { useEffect, useRef } from "react";
import { trackMetaSignupFunnelStep, type MetaFunnelStep } from "@/lib/meta-pixel-funnel";

/** Fires a signup funnel step once per distinct step_id per mount (wizard / onboarding steps). */
export function useMetaSignupFunnelStep(step: MetaFunnelStep | null): void {
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!step) return;
    const key = `${step.funnel}:${step.step_id}`;
    if (lastKey.current === key) return;
    lastKey.current = key;
    trackMetaSignupFunnelStep(step);
  }, [step]);
}
