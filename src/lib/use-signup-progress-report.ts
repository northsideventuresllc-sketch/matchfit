"use client";

import { useCallback, useEffect, useState } from "react";

import { SITE_ANALYTICS_VISITOR_COOKIE } from "@/lib/site-analytics-shared";
import { SignupProgressReporter, type SignupProgressRole } from "@/lib/signup-progress-reporter";

function getVisitorId(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${SITE_ANALYTICS_VISITOR_COOKIE}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

/**
 * Debounced reporter for anonymous signup-wizard progress, plus an unload-safe flush so an
 * abandoning visitor's last-typed email is not lost to a cancelled debounce timer or an
 * aborted in-flight fetch (see `signup-progress-reporter.ts` for why that mattered).
 */
export function useSignupProgressReport(role: SignupProgressRole) {
  const [reporter] = useState(() => new SignupProgressReporter({ role, getVisitorId }));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const flush = () => reporter.flush();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [reporter]);

  return useCallback(
    (fields: Record<string, boolean>, meta?: { email?: string; username?: string }) => {
      reporter.report(fields, meta);
    },
    [reporter],
  );
}
