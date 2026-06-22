"use client";

import { useEffect, useState } from "react";
import type { ClientPlanStatus } from "@/lib/client-plan-status";
import { ClientPlanStatusBanner } from "@/components/client/client-plan-status-banner";

export function ClientDashboardPlanBanner() {
  const [plan, setPlan] = useState<ClientPlanStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/client/billing/plan-status")
      .then((r) => r.json())
      .then((data: ClientPlanStatus) => {
        if (!cancelled && data.displayTier) setPlan(data);
      })
      .catch(() => {
        /* non-fatal */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!plan) return null;
  return <ClientPlanStatusBanner plan={plan} />;
}
