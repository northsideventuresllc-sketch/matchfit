"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminPortalAlert,
  AdminPortalPageHeader,
  AdminPortalShell,
  adminCardClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-portal-ui";

type PendingNudge = {
  id: string;
  trainerDraftId: string;
  email: string;
  firstName: string | null;
  createdAt: string;
};

/**
 * Approve-only queue (NI-Brain Decision #1280 / Learning #7461) for the Zero-Sales
 * Signup Engine resume nudge: the cron only queues a candidate here, it never emails
 * a trainer on its own. An admin has to explicitly approve or deny each one.
 */
export function TrainerResumeNudgesClient() {
  const [nudges, setNudges] = useState<PendingNudge[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/trainer-resume-nudges");
      const data = (await res.json()) as { nudges?: PendingNudge[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not load pending nudges.");
        return;
      }
      setNudges(data.nudges ?? []);
    } catch {
      setError("Could not load pending nudges.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- initial pending-nudge queue */
  useEffect(() => {
    void refresh();
  }, [refresh]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function decide(id: string, decision: "approve" | "deny") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/trainer-resume-nudges/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not record that decision.");
        return;
      }
      setNudges((prev) => prev.filter((n) => n.id !== id));
    } catch {
      setError("Could not record that decision.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminPortalShell maxWidth="max-w-3xl">
      <AdminPortalPageHeader
        title="Resume-Signup Nudges"
        description="Trainers who confirmed their email but never finished signing up. Approve to send the resume email now, or deny to leave them be."
      />

      <div className="mt-8 space-y-4">
        {error ? <AdminPortalAlert>{error}</AdminPortalAlert> : null}

        {loading ? (
          <p className="text-sm text-white/50">Loading…</p>
        ) : nudges.length === 0 ? (
          <p className="text-sm text-white/50">Nothing waiting on approval.</p>
        ) : (
          nudges.map((n) => (
            <div key={n.id} className={`${adminCardClass} flex items-center justify-between gap-4`}>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{n.firstName ?? "Coach"}</p>
                <p className="truncate text-xs text-white/50">{n.email}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-white/30">
                  Queued {new Date(n.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  className={adminPrimaryButtonClass}
                  disabled={busyId === n.id}
                  onClick={() => void decide(n.id, "approve")}
                >
                  Approve &amp; send
                </button>
                <button
                  type="button"
                  className={adminSecondaryButtonClass}
                  disabled={busyId === n.id}
                  onClick={() => void decide(n.id, "deny")}
                >
                  Deny
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </AdminPortalShell>
  );
}
