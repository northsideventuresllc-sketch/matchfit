"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TurnstileWidgetHandle } from "@/components/turnstile-widget";
import { TURNSTILE_SITE_KEY_PUBLIC } from "@/lib/turnstile-config";

export function useTurnstileGate() {
  const enabled = TURNSTILE_SITE_KEY_PUBLIC.length > 0;
  const siteKey = TURNSTILE_SITE_KEY_PUBLIC;
  const ref = useRef<TurnstileWidgetHandle>(null);
  const [ready, setReady] = useState(!enabled);
  const [widgetError, setWidgetError] = useState(false);

  const syncTokenState = useCallback(() => {
    const token = ref.current?.getToken();
    if (token) {
      setReady(true);
      setWidgetError(false);
      return true;
    }
    return false;
  }, []);

  const onTurnstileReady = useCallback(() => {
    syncTokenState();
  }, [syncTokenState]);

  const onTurnstileError = useCallback(() => {
    setReady(false);
    setWidgetError(true);
  }, []);

  const onTurnstileExpire = useCallback(() => {
    setReady(false);
    ref.current?.reset();
  }, []);

  const getToken = useCallback(() => ref.current?.getToken(), []);

  const reset = useCallback(() => {
    ref.current?.reset();
    setReady(false);
  }, []);

  /** Poll for token — Managed widgets sometimes have a token before `callback` fires. */
  useEffect(() => {
    if (!enabled) return;
    if (syncTokenState()) return;
    const id = window.setInterval(() => {
      if (syncTokenState()) window.clearInterval(id);
    }, 400);
    return () => window.clearInterval(id);
  }, [enabled, syncTokenState]);

  /** Returns null if OK, or a user-facing error string. */
  const validateBeforeSubmit = useCallback((): string | null => {
    if (!enabled) return null;
    const token = getToken();
    if (token) return null;
    if (widgetError) {
      return "Security check failed to load. Refresh the page or allow challenges.cloudflare.com, then try again.";
    }
    return "Please complete the security check before continuing.";
  }, [enabled, widgetError, getToken]);

  const turnstileField = useCallback((): { turnstileToken?: string } => {
    if (!enabled) return {};
    const token = getToken();
    return token ? { turnstileToken: token } : {};
  }, [enabled, getToken]);

  /** Token for `supabase.auth.signUp({ options: { captchaToken } })`. */
  const getCaptchaToken = useCallback((): string | undefined => getToken(), [getToken]);

  return {
    enabled,
    siteKey,
    ref,
    ready,
    widgetError,
    onTurnstileReady,
    onTurnstileError,
    onTurnstileExpire,
    validateBeforeSubmit,
    turnstileField,
    getCaptchaToken,
    reset,
  };
}
