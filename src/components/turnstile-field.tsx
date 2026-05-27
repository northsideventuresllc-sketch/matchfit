"use client";

import { TurnstileWidget } from "@/components/turnstile-widget";
import type { useTurnstileGate } from "@/hooks/use-turnstile-gate";

type TurnstileGate = ReturnType<typeof useTurnstileGate>;

export function TurnstileField({ gate, className }: { gate: TurnstileGate; className?: string }) {
  if (!gate.enabled) return null;

  return (
    <div className={className ?? "flex flex-col items-center gap-2 py-1"}>
      <TurnstileWidget
        ref={gate.setWidgetHandle}
        siteKey={gate.siteKey}
        onReady={gate.onTurnstileReady}
        onError={gate.onTurnstileError}
        onExpire={gate.onTurnstileExpire}
      />
      {gate.widgetError ? (
        <p className="text-center text-xs text-amber-200/90" role="status">
          Security check could not load. Refresh the page or allow challenges.cloudflare.com.
        </p>
      ) : !gate.ready ? (
        <p className="text-center text-xs text-white/40" role="status">
          Loading security check…
        </p>
      ) : null}
    </div>
  );
}
