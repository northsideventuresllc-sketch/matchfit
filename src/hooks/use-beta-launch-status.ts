"use client";

import { useEffect, useState } from "react";

export type BetaLaunchStatus = {
  gatesEnabled: boolean;
  trainerCap: number | null;
  clientCap: number | null;
  /** Registered real signups (excludes test / synthetic accounts). */
  trainerCount: number | null;
  clientCount: number | null;
  /** Registered + active waitlist invites (drives cap / waitlist). */
  trainerSlotsUsed: number | null;
  clientSlotsUsed: number | null;
  trainerSlotsRemaining: number | null;
  clientSlotsRemaining: number | null;
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
            trainerSlotsUsed: null,
            clientSlotsUsed: null,
            trainerSlotsRemaining: null,
            clientSlotsRemaining: null,
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
