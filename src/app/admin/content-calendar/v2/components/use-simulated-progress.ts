"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Phase weighting for the simulated generation/job progress bar. There is no token-level percentage
 * from the AI / durable-job backend, so we approximate: the request-sent phase claims the first 10%,
 * the generating phase animates smoothly up to (but never reaching) 70% while we await the response,
 * and the finalizing phase animates the remaining 30% to 100% once the promise resolves. This keeps
 * the bar always moving instead of jumping, and never shows 100% before the work actually returns.
 */
export const PROGRESS_PHASE_WEIGHTS = { requestSent: 10, generating: 60, finalizing: 30 } as const;

const GENERATING_CEILING = PROGRESS_PHASE_WEIGHTS.requestSent + PROGRESS_PHASE_WEIGHTS.generating - 1; // 69

export function useSimulatedProgress() {
  const [percent, setPercent] = useState(0);
  const [active, setActive] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const resetRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (resetRef.current !== null) {
      window.clearTimeout(resetRef.current);
      resetRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const start = useCallback(() => {
    clearTimers();
    setActive(true);
    setPercent(PROGRESS_PHASE_WEIGHTS.requestSent);
    intervalRef.current = window.setInterval(() => {
      setPercent((p) => {
        if (p >= GENERATING_CEILING) return GENERATING_CEILING;
        const remaining = GENERATING_CEILING - p;
        return Math.min(GENERATING_CEILING, p + Math.max(0.6, remaining * 0.06));
      });
    }, 200);
  }, [clearTimers]);

  const finish = useCallback(() => {
    clearTimers();
    intervalRef.current = window.setInterval(() => {
      setPercent((p) => {
        if (p >= 100) {
          if (intervalRef.current !== null) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          resetRef.current = window.setTimeout(() => {
            setActive(false);
            setPercent(0);
          }, 550);
          return 100;
        }
        return Math.min(100, p + 4);
      });
    }, 30);
  }, [clearTimers]);

  const fail = useCallback(() => {
    clearTimers();
    setActive(false);
    setPercent(0);
  }, [clearTimers]);

  return { percent: Math.round(percent), active, start, finish, fail };
}
