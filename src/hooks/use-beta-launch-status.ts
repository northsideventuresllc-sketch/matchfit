"use client";

import { useEffect, useState } from "react";

export type BetaLaunchStatus = {
  gatesEnabled: boolean;
  trainerCap: number | null;
  clientCap: number | null;
  trainerCount: number | null;
  clientCount: number | null;
  trainerWaitlistOpen: boolean;
  clientWaitlistOpen: boolean;
};

export function useBetaLaunchStatus(): { status: BetaLaunchStatus | null; loading: boolean } {
  const [status, setStatus] = useState<BetaLaunchStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/public/beta-launch-status")
      .then((r) => r.json())
      .then((d: BetaLaunchStatus) => {
        if (!cancelled) setStatus(d);
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({
            gatesEnabled: false,
            trainerCap: null,
            clientCap: null,
            trainerCount: null,
            clientCount: null,
            trainerWaitlistOpen: false,
            clientWaitlistOpen: false,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { status, loading };
}
