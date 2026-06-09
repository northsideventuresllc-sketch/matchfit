"use client";

import { useCallback, useRef } from "react";

import { SITE_ANALYTICS_VISITOR_COOKIE } from "@/lib/site-analytics-shared";

function getVisitorId(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${SITE_ANALYTICS_VISITOR_COOKIE}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

export function useSignupProgressReport(role: "client" | "trainer") {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback(
    (fields: Record<string, boolean>, meta?: { email?: string; username?: string }) => {
      const visitorId = getVisitorId();
      if (!visitorId) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void fetch("/api/public/signup-progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role, visitorId, fields, ...meta }),
        });
      }, 400);
    },
    [role],
  );
}
