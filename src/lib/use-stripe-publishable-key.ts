"use client";

import { useEffect, useState } from "react";

type StripePublishableKeyState = {
  publishableKey: string | null;
  loading: boolean;
};

/**
 * Resolves Stripe publishable key at runtime (server prop, then public API).
 * Avoids client bundles missing NEXT_PUBLIC_* vars that were added after build.
 */
export function useStripePublishableKey(serverKey?: string | null): StripePublishableKeyState {
  const normalizedServerKey = serverKey?.trim() || null;
  const [publishableKey, setPublishableKey] = useState<string | null>(normalizedServerKey);
  const [loading, setLoading] = useState(!normalizedServerKey);

  useEffect(() => {
    if (normalizedServerKey) return;

    let cancelled = false;
    void fetch("/api/public/stripe-publishable-key", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { publicKey?: string | null }) => {
        if (cancelled) return;
        setPublishableKey(d.publicKey?.trim() || null);
      })
      .catch(() => {
        if (!cancelled) setPublishableKey(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedServerKey]);

  return { publishableKey, loading };
}
