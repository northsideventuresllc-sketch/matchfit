"use client";

import type { Ref } from "react";
import { TurnstileWidget } from "@/components/turnstile-widget";
import type { TurnstileWidgetHandle } from "@/components/turnstile-widget";

type TurnstileFieldGate = {
  enabled: boolean;
  siteKey: string;
  widgetRef: Ref<TurnstileWidgetHandle>;
  ready: boolean;
  widgetError: boolean;
  onTurnstileReady: () => void;
  onTurnstileError: () => void;
  onTurnstileExpire: () => void;
};

type TurnstileFieldProps = TurnstileFieldGate & {
  className?: string;
};

export function TurnstileField({
  enabled,
  siteKey,
  widgetRef,
  ready,
  widgetError,
  onTurnstileReady,
  onTurnstileError,
  onTurnstileExpire,
  className,
}: TurnstileFieldProps) {
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
      ) : !ready ? (
        <p className="text-center text-xs text-white/40" role="status">
          Loading security check…
        </p>
      ) : null}
    </div>
  );
}
