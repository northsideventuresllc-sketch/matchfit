"use client";

import { TurnstileWidget } from "@/components/turnstile-widget";
import type { TurnstileWidgetHandle } from "@/components/turnstile-widget";

type TurnstileGate = {
  enabled: boolean;
  setWidgetHandle: (handle: TurnstileWidgetHandle | null) => void;
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
    setWidgetHandle,
    siteKey,
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
        ref={setWidgetHandle}
        siteKey={siteKey}
        onReady={onTurnstileReady}
        onError={onTurnstileError}
        onExpire={onTurnstileExpire}
      />
      {widgetError ? (
        <p className="text-center text-xs text-amber-200/90" role="status">
          Security check could not load. Refresh the page or allow challenges.cloudflare.com.
        </p>
      ) : !ready ? (
        <p className="text-center text-xs text-white/40" role="status">
          Loading security check…
        </p>
      ) : null}
    </div>
  );
}
