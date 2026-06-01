"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  SITE_ANALYTICS_SESSION_KEY,
  SITE_ANALYTICS_VISITOR_COOKIE,
  type SiteAnalyticsKind,
} from "@/lib/site-analytics-shared";

const VISITOR_MAX_AGE_DAYS = 400;

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function writeCookie(name: string, value: string) {
  const maxAge = VISITOR_MAX_AGE_DAYS * 24 * 60 * 60;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

export function getVisitorId(): string {
  const existing = readCookie(SITE_ANALYTICS_VISITOR_COOKIE);
  if (existing && existing.length >= 8) return existing;
  const next = randomId();
  writeCookie(SITE_ANALYTICS_VISITOR_COOKIE, next);
  return next;
}

export function getSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SITE_ANALYTICS_SESSION_KEY);
    if (existing && existing.length >= 8) return existing;
    const next = randomId();
    sessionStorage.setItem(SITE_ANALYTICS_SESSION_KEY, next);
    return next;
  } catch {
    return randomId();
  }
}

export function currentPath(pathname: string): string {
  const base = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return base.split("?")[0]?.split("#")[0] ?? base;
}

export function shouldTrackPath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (path.startsWith("/admin")) return false;
  if (path.startsWith("/api/")) return false;
  return true;
}

export function linkLabelFromAnchor(anchor: HTMLAnchorElement): string | null {
  const aria = anchor.getAttribute("aria-label")?.trim();
  if (aria) return aria.slice(0, 200);
  const text = anchor.textContent?.replace(/\s+/g, " ").trim();
  if (text) return text.slice(0, 200);
  const title = anchor.getAttribute("title")?.trim();
  return title ? title.slice(0, 200) : null;
}

export async function sendEvent(payload: {
  kind: SiteAnalyticsKind;
  path: string;
  targetPath?: string;
  targetUrl?: string;
  linkLabel?: string;
}) {
  const visitorId = getVisitorId();
  const sessionId = getSessionId();
  try {
    await fetch("/api/public/site-analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        visitorId,
        sessionId,
      }),
      keepalive: true,
      credentials: "same-origin",
    });
  } catch {
    // Best-effort analytics; ignore network failures.
  }
}

/** Records anonymous page views and link clicks for administrator traffic reporting. */
export function SiteAnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPageKey = useRef<string | null>(null);

  useEffect(() => {
    const path = currentPath(pathname ?? "/");
    if (!shouldTrackPath(path)) return;

    const pageKey = path;
    if (lastPageKey.current === pageKey) return;
    lastPageKey.current = pageKey;

    void sendEvent({ kind: "PAGE_VIEW", path });
  }, [pathname, searchParams]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href")?.trim();
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }
      if (href.startsWith("javascript:")) return;

      const path = currentPath(pathname ?? "/");
      if (!shouldTrackPath(path)) return;

      let targetPath: string | undefined;
      let targetUrl: string | undefined;

      try {
        const url = new URL(href, window.location.origin);
        if (url.origin === window.location.origin) {
          const normalized = url.pathname.split("?")[0]?.split("#")[0] ?? url.pathname;
          if (!shouldTrackPath(normalized)) return;
          targetPath = normalized;
        } else {
          targetUrl = url.toString().slice(0, 500);
        }
      } catch {
        return;
      }

      void sendEvent({
        kind: "LINK_CLICK",
        path,
        targetPath,
        targetUrl,
        linkLabel: linkLabelFromAnchor(anchor) ?? undefined,
      });
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname, searchParams]);

  return null;
}
