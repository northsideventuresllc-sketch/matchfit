"use client";

import { useEffect, useState } from "react";

/** Millisecond timestamp for render; advances on an interval (default 30s). Avoids `Date.now()` during pure render. */
export function useNowMs(updateEveryMs = 30_000): number {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => {
      setT(Date.now());
    }, updateEveryMs);
    return () => window.clearInterval(id);
  }, [updateEveryMs]);
  return t;
}
