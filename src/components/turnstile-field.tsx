"use client";

import { TurnstileWidget } from "@/components/turnstile-widget";
import type { TurnstileWidgetHandle } from "@/components/turnstile-widget";
import type { Ref } from "react";

type TurnstileGate = {
  enabled: boolean;
  widgetRef: Ref<TurnstileWidgetHandle>;
  siteKey: string;
  onTurnstileReady: () => void;
  onTurnstileError: () => void;
  onTurnstileExpire: () => void;
  widgetError: boolean;
  ready: boolean;
};

export function TurnstileField({ gate, className }: { gate: TurnstileGate; className?: string }) {
  const {
    enabled,
    siteKey,
    widgetRef,
    onTurnstileReady,
    onTurnstileError,
    onTurnstileExpire,
    widgetError,
    ready,
  } = gate;

  if (!enabled) return null;

  return (
    <div className={className ?? "flex flex-col items-center gap-2 py-1"}>
      <TurnstileWidget
        ref={widgetRef}
        siteKey={siteKey}
        onReady={onTurnstileReady}
        onError={onTurnstileError}
        onExpire={onTurnstileExpire}
      />
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
