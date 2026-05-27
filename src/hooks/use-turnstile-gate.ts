"use client";

import { useCallback, useRef, useState } from "react";
import type { TurnstileWidgetHandle } from "@/components/turnstile-widget";
import { TURNSTILE_SITE_KEY_PUBLIC } from "@/lib/turnstile-config";

export function useTurnstileGate() {
  const enabled = TURNSTILE_SITE_KEY_PUBLIC.length > 0;
  const siteKey = TURNSTILE_SITE_KEY_PUBLIC;
  const ref = useRef<TurnstileWidgetHandle>(null);
  const [ready, setReady] = useState(!enabled);
  const [widgetError, setWidgetError] = useState(false);

  const onTurnstileReady = useCallback(() => {
    setReady(true);
    setWidgetError(false);
  }, []);

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

  /** Returns null if OK, or a user-facing error string. */
  const validateBeforeSubmit = useCallback((): string | null => {
    if (!enabled) return null;
    if (widgetError) {
      return "Security check failed to load. Refresh the page or disable ad blockers, then try again.";
    }
    if (!ready) {
      return "Please wait for the security check to finish, then try again.";
    }
    if (!getToken()) {
      return "Please complete the security check before continuing.";
    }
    return null;
  }, [enabled, widgetError, ready, getToken]);

  const turnstileField = useCallback((): { turnstileToken?: string } => {
    if (!enabled) return {};
    const token = getToken();
    return token ? { turnstileToken: token } : {};
  }, [enabled, getToken]);

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
    reset,
  };
}
