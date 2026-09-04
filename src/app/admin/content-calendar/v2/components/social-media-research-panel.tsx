"use client";

import { useCallback, useEffect, useState } from "react";
import { adminCardClass, adminPrimaryButtonClass, adminSecondaryButtonClass } from "@/components/admin/admin-portal-ui";
import { Modal, ProgressBar, readApi } from "./ui-bits";
import { ReportArtifactViewer } from "./report-artifact-viewer";
import { useSimulatedProgress } from "./use-simulated-progress";

/** Mirrors serializeResearchRun() in @/lib/content-calendar/content-research-store (server-only, not importable from a client component). */
type ResearchRun = {
  id: string;
  status: "running" | "complete" | "failed";
  trigger: "manual" | "scheduled";
  runDate: string;
  summary: string | null;
  reportBody: string | null;
  model: string | null;
  error: string | null;
  adminId: string | null;
  createdAt: string;
  completedAt: string | null;
};

type ArchiveMonth = { year: number; month: number; count: number };

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function oneLineSummary(run: ResearchRun): string {
  if (run.status === "failed") return run.error ?? "This run failed.";
  return run.summary?.trim() || "No summary recorded for this run.";
}

/** Row shared by the recent list and every archive drill-down level — click to preview, or open in a new tab. */
function RunRow({ run, onPreview }: { run: ResearchRun; onPreview: (id: string) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
      <button
        type="button"
        onClick={() => onPreview(run.id)}
        className="min-w-0 flex-1 text-left"
      >
        <p className="text-xs font-black uppercase tracking-wide text-[#FFD34E]">{run.runDate}</p>
        <p className="mt-0.5 truncate text-sm text-white/75">{oneLineSummary(run)}</p>
      </button>
      <a
        href={`/admin/content-calendar/v2/research/${run.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`${adminSecondaryButtonClass} shrink-0`}
      >
        Open In New Tab ↗
      </a>
    </div>
  );
}

/** Year → month → dated runs drill-down. Chosen over a raw date-picker because the archive/months endpoint already
 * returns exactly the {year, month, count} buckets that exist — a date picker would let the operator pick empty
 * days with no way to tell in advance, where a counted drill-down only ever shows days that have something in them. */
function ArchiveBrowser({
  disabled,
  setError,
  onPreview,
}: {
  disabled: boolean;
  setError: (msg: string | null) => void;
  onPreview: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loadingMonths, setLoadingMonths] = useState(false);
  const [months, setMonths] = useState<ArchiveMonth[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [monthRuns, setMonthRuns] = useState<ResearchRun[]>([]);

  const loadMonths = useCallback(async () => {
    setLoadingMonths(true);
    try {
      const res = await fetch("/api/admin/content-calendar/v2/research/archive/months", { credentials: "include" });
      const data = await readApi<{ months: ArchiveMonth[] }>(res, "Could not load the research archive.");
      setMonths(data.months ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the research archive.");
    } finally {
      setLoadingMonths(false);
    }
  }, [setError]);

  useEffect(() => {
    if (open && !months.length) queueMicrotask(() => void loadMonths());
  }, [open, months.length, loadMonths]);

  const openMonth = useCallback(
    async (year: number, month: number) => {
      setSelectedYear(year);
      setSelectedMonth(month);
      setLoadingRuns(true);
      try {
        const res = await fetch(`/api/admin/content-calendar/v2/research/archive/${year}/${month}`, {
          credentials: "include",
        });
        const data = await readApi<{ runs: ResearchRun[] }>(res, "Could not load that month's research runs.");
        setMonthRuns(data.runs ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load that month's research runs.");
      } finally {
        setLoadingRuns(false);
      }
    },
    [setError],
  );

  // Group by year for the top-level list.
  const byYear = new Map<number, ArchiveMonth[]>();
  for (const m of months) {
    const list = byYear.get(m.year) ?? [];
    list.push(m);
    byYear.set(m.year, list);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);

  return (
    <section className={adminCardClass}>
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
      >
        <div>
          <h3 className="text-sm font-black uppercase tracking-[0.14em] text-white">Archive</h3>
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-white/40">Organized by year and month</p>
        </div>
        <span className="text-white/50">{open ? "▾" : "▸"}</span>
      </button>

      {open ? (
        <div className="mt-4 space-y-4">
          {loadingMonths ? <p className="text-sm text-white/50">Loading archive months…</p> : null}

          {!loadingMonths && !years.length ? (
            <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/45">
              No archived research runs yet.
            </p>
          ) : null}

          {years.map((year) => (
            <div key={year}>
              <p className="text-xs font-black uppercase tracking-wide text-white/60">{year}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(byYear.get(year) ?? [])
                  .sort((a, b) => b.month - a.month)
                  .map((m) => {
                    const isActive = selectedYear === year && selectedMonth === m.month;
                    return (
                      <button
                        key={`${m.year}-${m.month}`}
                        type="button"
                        onClick={() => void openMonth(m.year, m.month)}
                        className={
                          isActive
                            ? "rounded-lg border border-[#FF7E00] bg-[#FF7E00]/15 px-3 py-1.5 text-xs font-bold text-[#FFD34E]"
                            : "rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs font-bold text-white/70 hover:border-white/25"
                        }
                      >
                        {MONTH_NAMES[m.month - 1] ?? m.month} ({m.count})
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}

          {selectedYear && selectedMonth ? (
            <div className="border-t border-white/[0.06] pt-4">
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-white/60">
                {MONTH_NAMES[selectedMonth - 1] ?? selectedMonth} {selectedYear}
              </p>
              {loadingRuns ? <p className="text-sm text-white/50">Loading runs…</p> : null}
              {!loadingRuns && !monthRuns.length ? (
                <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/45">
                  No runs in this month.
                </p>
              ) : null}
              <div className="space-y-2">
                {monthRuns.map((run) => (
                  <RunRow key={run.id} run={run} onPreview={onPreview} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function SocialMediaResearchPanel({
  disabled,
  setError,
  setNotice,
}: {
  disabled: boolean;
  setError: (msg: string | null) => void;
  setNotice: (msg: string | null) => void;
}) {
  const [recent, setRecent] = useState<ResearchRun[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [running, setRunning] = useState(false);
  const [axonFindings, setAxonFindings] = useState<Array<{ id: string; text: string; date: string | null }>>([]);
  const progress = useSimulatedProgress();

  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewRun, setPreviewRun] = useState<ResearchRun | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const loadRecent = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const res = await fetch("/api/admin/content-calendar/v2/research/recent", { credentials: "include" });
      const data = await readApi<{ runs: ResearchRun[] }>(res, "Could not load recent research runs.");
      setRecent(data.runs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load recent research runs.");
    } finally {
      setLoadingRecent(false);
    }
  }, [setError]);

  const loadAxonFindings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/content-calendar/v2/research/axon-findings", { credentials: "include" });
      const data = await readApi<{ findings: Array<{ id: string; text: string; date: string | null }> }>(
        res,
        "Could not load AXON findings.",
      );
      setAxonFindings(data.findings ?? []);
    } catch {
      // AXON findings are supplementary — never block the panel on them.
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadRecent();
      void loadAxonFindings();
    });
    // Only on mount — the run button prepends its own result, and the archive browser has its own loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runResearch = useCallback(async () => {
    setRunning(true);
    setError(null);
    progress.start();
    try {
      const res = await fetch("/api/admin/content-calendar/v2/research/run", {
        method: "POST",
        credentials: "include",
      });
      const data = await readApi<{ run: ResearchRun }>(res, "Could not run social media research.");
      progress.finish();
      if (data.run) {
        setRecent((prev) => [data.run, ...prev].slice(0, 5));
        setNotice("Social media research run complete.");
      }
    } catch (e) {
      progress.fail();
      setError(e instanceof Error ? e.message : "Could not run social media research.");
    } finally {
      setRunning(false);
    }
  }, [progress, setError, setNotice]);

  const openPreview = useCallback(async (id: string) => {
    setPreviewId(id);
    setPreviewRun(null);
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/admin/content-calendar/v2/research/${id}`, { credentials: "include" });
      const data = await readApi<{ run: ResearchRun }>(res, "Could not load that research run.");
      setPreviewRun(data.run);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Could not load that research run.");
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const closePreview = useCallback(() => {
    setPreviewId(null);
    setPreviewRun(null);
    setPreviewError(null);
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#FF7E00]/30 bg-[#FF7E00]/10 p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FFD34E]">Social Media Research</p>
        <p className="mt-2 text-sm leading-relaxed text-white/75">
          Runs a research pass on fitness-content trends and Match Fit&apos;s own recent content and performance, then
          reports what&apos;s working, what needs work, and what to push next. This can take a few minutes.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={adminPrimaryButtonClass}
            disabled={disabled || running}
            onClick={() => void runResearch()}
          >
            {running ? "Running…" : "Run Social Media Research"}
          </button>
          {disabled ? <p className="text-xs text-white/50">Research is unavailable until AI and NI Brain are configured.</p> : null}
        </div>
        {progress.active ? (
          <div className="mt-4">
            <ProgressBar percent={progress.percent} label="Running social media research" />
          </div>
        ) : null}
      </section>

      <section className={adminCardClass}>
        <h3 className="text-sm font-black uppercase tracking-[0.14em] text-white">Latest AXON Research</h3>
        <p className="mt-0.5 text-[11px] uppercase tracking-wide text-white/40">
          What the daily AXON agent found for Match Fit
        </p>
        <div className="mt-4 space-y-2">
          {axonFindings.length ? (
            axonFindings.map((f) => (
              <div
                key={f.id}
                className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm leading-relaxed text-white/75"
              >
                {f.date ? (
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-[#FFD34E]">
                    {new Date(f.date).toLocaleDateString()}
                  </p>
                ) : null}
                {f.text}
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/45">
              No AXON research findings for Match Fit yet — they appear here after the daily agent runs.
            </p>
          )}
        </div>
      </section>

      <section className={adminCardClass}>
        <h3 className="text-sm font-black uppercase tracking-[0.14em] text-white">Recent Runs</h3>
        <p className="mt-0.5 text-[11px] uppercase tracking-wide text-white/40">The 5 most recent completed runs</p>

        <div className="mt-4 space-y-2">
          {loadingRecent ? <p className="text-sm text-white/50">Loading recent runs…</p> : null}
          {!loadingRecent && !recent.length ? (
            <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/45">
              No research runs yet. Run one above to get started.
            </p>
          ) : null}
          {recent.map((run) => (
            <RunRow key={run.id} run={run} onPreview={openPreview} />
          ))}
        </div>
      </section>

      <ArchiveBrowser disabled={disabled} setError={setError} onPreview={openPreview} />

      {previewId ? (
        <Modal onClose={closePreview} maxWidthClass="max-w-3xl">
          {previewLoading ? <p className="text-sm text-white/50">Loading report…</p> : null}
          {previewError ? <p className="text-sm font-semibold text-[#FFB4B4]">{previewError}</p> : null}
          {previewRun ? (
            // ReportArtifactViewer is built for a standalone full page (min-h-screen) — this wrapper
            // caps and scrolls it so it behaves inside the Modal's card instead of overflowing it.
            <div className="-m-5 max-h-[80vh] overflow-y-auto rounded-xl sm:-m-6">
              <ReportArtifactViewer
                title="Social Media Research"
                dateLabel={previewRun.runDate}
                summary={previewRun.summary ?? ""}
                reportBody={
                  previewRun.reportBody ??
                  (previewRun.status === "failed"
                    ? `This run failed: ${previewRun.error ?? "Unknown error."}`
                    : "Report not available yet.")
                }
                model={previewRun.model}
              />
            </div>
          ) : null}
          {previewRun ? (
            <div className="mt-4 flex justify-end">
              <a
                href={`/admin/content-calendar/v2/research/${previewRun.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className={adminSecondaryButtonClass}
              >
                Open In New Tab ↗
              </a>
            </div>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}
