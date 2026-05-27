"use client";

import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/turnstile-widget";

type TurnstileFieldGate = {
  enabled: boolean;
  setWidgetRef: (widget: TurnstileWidgetHandle | null) => void;
  siteKey: string;
  ready: boolean;
  widgetError: boolean;
  onTurnstileReady: () => void;
  onTurnstileError: () => void;
  onTurnstileExpire: () => void;
};

export function TurnstileField({ gate, className }: { gate: TurnstileFieldGate; className?: string }) {
  if (!gate.enabled) return null;
  const { setWidgetRef, siteKey, onTurnstileReady, onTurnstileError, onTurnstileExpire, widgetError, ready } = gate;

  return (
    <div className={className ?? "flex flex-col items-center gap-2 py-1"}>
      <TurnstileWidget
        ref={setWidgetRef}
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
