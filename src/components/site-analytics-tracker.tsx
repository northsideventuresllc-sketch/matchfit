"use client";

import { useEffect, useRef } from "react";
import {
  SITE_ANALYTICS_SESSION_KEY,
  SITE_ANALYTICS_VISITOR_COOKIE,
} from "@/lib/site-analytics-shared";

function randomId(): string {
  return crypto.randomUUID();
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function ensureIds(): { visitorId: string; sessionId: string } {
  let visitorId = getCookie(SITE_ANALYTICS_VISITOR_COOKIE);
  if (!visitorId) {
    visitorId = randomId();
    setCookie(SITE_ANALYTICS_VISITOR_COOKIE, visitorId);
  }
  let sessionId = sessionStorage.getItem(SITE_ANALYTICS_SESSION_KEY);
  if (!sessionId) {
    sessionId = randomId();
    sessionStorage.setItem(SITE_ANALYTICS_SESSION_KEY, sessionId);
  }
  return { visitorId, sessionId };
}

function sendEvent(payload: Record<string, unknown>) {
  void fetch("/api/public/site-analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined);
}

/** First-party page view + CTA click tracking for admin analytics. */
export function SiteAnalyticsTracker() {
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    const { visitorId, sessionId } = ensureIds();
    const path = `${window.location.pathname}${window.location.search}`;

    if (lastPath.current !== path) {
      lastPath.current = path;
      sendEvent({ kind: "PAGE_VIEW", path, visitorId, sessionId });
    }

    function onClick(e: MouseEvent) {
      const el = (e.target as HTMLElement | null)?.closest("a,button");
      if (!el) return;
      const label =
        el.getAttribute("aria-label")?.trim() ||
        el.getAttribute("data-analytics-label")?.trim() ||
        el.textContent?.trim().slice(0, 120) ||
        null;
      const href = el instanceof HTMLAnchorElement ? el.getAttribute("href") : null;
      const targetPath = href?.startsWith("/") ? href.split("?")[0] : null;
      const targetUrl = href && !href.startsWith("/") ? href : null;
      sendEvent({
        kind: "LINK_CLICK",
        path,
        targetPath,
        targetUrl,
        linkLabel: label,
        visitorId,
        sessionId,
      });
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
