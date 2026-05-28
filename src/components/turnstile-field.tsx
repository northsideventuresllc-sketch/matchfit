"use client";

import { TurnstileWidget } from "@/components/turnstile-widget";
import type { TurnstileWidgetHandle } from "@/components/turnstile-widget";
import type { Ref } from "react";

export type TurnstileFieldProps = {
  enabled: boolean;
  widgetRef: Ref<TurnstileWidgetHandle>;
  siteKey: string;
  onReady: () => void;
  onError: () => void;
  onExpire: () => void;
  widgetError: boolean;
  ready: boolean;
  className?: string;
};

export function TurnstileField({
  enabled,
  widgetRef,
  siteKey,
  onReady,
  onError,
  onExpire,
  widgetError,
  ready,
  className,
}: TurnstileFieldProps) {
  if (!enabled) return null;

  return (
    <div className={className ?? "flex flex-col items-center gap-2 py-1"}>
      <TurnstileWidget ref={widgetRef} siteKey={siteKey} onReady={onReady} onError={onError} onExpire={onExpire} />
      {widgetError ? (
        <p className="text-center text-xs text-amber-200/90" role="status">
          Security check could not load. Refresh the page or allow challenges.cloudflare.com.
        </p>
      ) : !ready && !widgetError ? (
        <p className="text-center text-xs text-white/40" role="status">
          Complete the security check below, then sign in.
        </p>
      ) : null}
    </div>
  );
}
