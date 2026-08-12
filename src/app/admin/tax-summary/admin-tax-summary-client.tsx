"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminPortalAlert,
  AdminPortalPageHeader,
  AdminPortalShell,
  adminCardClass,
  adminInputClass,
} from "@/components/admin/admin-portal-ui";

type Row = {
  trainerId: string;
  totalEarnedCents: number;
  overThreshold: boolean;
  trainer: { id: string; email: string; firstName: string; lastName: string; username: string } | null;
};

/**
 * Internal reporting only — tells staff who earned $600+ in a tax year so a 1099-NEC is owed.
 * Does not file anything with the IRS: the actual filing mechanism (Stripe Connect's own tax
 * forms once live, a separate filing vendor, or a manual/accountant process) is a decision for
 * JB, not something built into this tool.
 */
export function AdminTaxSummaryClient() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<Row[]>([]);
  const [thresholdCents, setThresholdCents] = useState(60_000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (y: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tax/1099-summary?year=${y}`);
      const data = (await res.json()) as {
        rows?: Row[];
        thresholdCents?: number;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not load tax summary.");
        return;
      }
      setRows(data.rows ?? []);
      setThresholdCents(data.thresholdCents ?? 60_000);
    } catch {
      setError("Could not load tax summary.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load(year);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const overThresholdRows = rows.filter((r) => r.overThreshold);

  return (
    <AdminPortalShell>
      <AdminPortalPageHeader
        title="1099 Tax Summary"
        description={
          <>
            Every Fitness Pro who earned money on Match Fit this tax year, and whether they crossed the $
            {(thresholdCents / 100).toFixed(0)} IRS reporting threshold. This is a summary only — it does not file
            anything with the IRS.
          </>
        }
      />

      <div className="mt-6 flex items-center gap-3">
        <label htmlFor="tax-year" className="text-xs font-semibold uppercase tracking-wide text-white/50">
          Tax year
        </label>
        <input
          id="tax-year"
          type="number"
          value={year}
          onChange={(e) => setYear(Number.parseInt(e.target.value, 10) || year)}
          className={`${adminInputClass} w-28`}
        />
      </div>

      {error ? (
        <div className="mt-4">
          <AdminPortalAlert>{error}</AdminPortalAlert>
        </div>
      ) : null}

      <div className={`${adminCardClass} mt-6`}>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">
          {overThresholdRows.length} over threshold · {rows.length} total with earnings
        </p>
        {loading ? (
          <p className="mt-4 text-sm text-white/50">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-white/50">No earnings recorded for {year}.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-wide text-white/40">
                  <th className="pb-2 pr-4">Fitness Pro</th>
                  <th className="pb-2 pr-4">Email</th>
                  <th className="pb-2 pr-4">Earned</th>
                  <th className="pb-2">1099 owed</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.trainerId} className="border-t border-white/[0.06]">
                    <td className="py-2 pr-4">
                      {r.trainer ? `@${r.trainer.username}` : r.trainerId}
                    </td>
                    <td className="py-2 pr-4 text-white/60">{r.trainer?.email ?? "—"}</td>
                    <td className="py-2 pr-4 font-semibold">${(r.totalEarnedCents / 100).toFixed(2)}</td>
                    <td className="py-2">
                      {r.overThreshold ? (
                        <span className="rounded-full bg-[#FF7E00]/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#FFD34E]">
                          Yes
                        </span>
                      ) : (
                        <span className="text-white/35">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminPortalShell>
  );
}
