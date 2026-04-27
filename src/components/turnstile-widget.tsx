"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement | string, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
      getResponse?: (widgetId?: string) => string | undefined;
    };
  }
}

let turnstileScriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => {
          turnstileScriptPromise = null;
          reject(new Error("Turnstile script failed"));
        },
        { once: true },
      );
      if (window.turnstile) resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      turnstileScriptPromise = null;
      reject(new Error("Turnstile script failed"));
    };
    document.head.appendChild(s);
  });
  return turnstileScriptPromise;
}

export type TurnstileWidgetHandle = {
  getToken: () => string | undefined;
  reset: () => void;
};

type TurnstileWidgetProps = {
  siteKey: string;
  className?: string;
};

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  function TurnstileWidget({ siteKey, className }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

    useImperativeHandle(ref, () => ({
      getToken: () => {
        const id = widgetIdRef.current;
        if (!id || !window.turnstile?.getResponse) return undefined;
        return window.turnstile.getResponse(id) || undefined;
      },
      reset: () => {
        const id = widgetIdRef.current;
        if (id && window.turnstile) window.turnstile.reset(id);
      },
    }));

    useEffect(() => {
      if (!siteKey) return;
      let cancelled = false;

      void loadTurnstileScript()
        .then(() => {
          if (cancelled || !containerRef.current || !window.turnstile) return;
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme: "dark",
          });
        })
        .catch(() => {
          /* non-fatal: submit will fail server-side or user retries */
        });

      return () => {
        cancelled = true;
        const id = widgetIdRef.current;
        widgetIdRef.current = null;
        if (id && window.turnstile) {
          try {
            window.turnstile.remove(id);
          } catch {
            /* ignore */
          }
        }
      };
    }, [siteKey]);

    return <div ref={containerRef} className={className} />;
  },
);
