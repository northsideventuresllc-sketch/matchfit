import "server-only";

import { currentEtCalendarDate } from "@/lib/content-calendar/pending-schedule";
import { createNiBrainClient } from "@/lib/ni-brain-client";

export type ContentResearchRunStatus = "running" | "complete" | "failed";
export type ContentResearchRunTrigger = "manual" | "scheduled";

export type ContentResearchRunRow = {
  id: string;
  status: ContentResearchRunStatus;
  trigger: ContentResearchRunTrigger;
  /** America/New_York calendar date (YYYY-MM-DD) the run belongs to — not a UTC timestamp date. */
  run_date: string;
  summary: string | null;
  report_body: string | null;
  model: string | null;
  error: string | null;
  admin_id: string | null;
  created_at: string;
  completed_at: string | null;
};

export function serializeResearchRun(row: ContentResearchRunRow) {
  return {
    id: row.id,
    status: row.status,
    trigger: row.trigger,
    runDate: row.run_date,
    summary: row.summary,
    reportBody: row.report_body,
    model: row.model,
    error: row.error,
    adminId: row.admin_id,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export type ClientContentResearchRun = ReturnType<typeof serializeResearchRun>;

/** Starts a new research run "running" for today's ET calendar date. */
export async function createRunningResearchRun(args: {
  adminId: string | null;
  trigger?: ContentResearchRunTrigger;
}): Promise<ContentResearchRunRow> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_research_runs")
    .insert({
      status: "running",
      trigger: args.trigger ?? "manual",
      run_date: currentEtCalendarDate(),
      admin_id: args.adminId,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ContentResearchRunRow;
}

/**
 * Recent Match Fit findings written by AXON's daily Social Media Research agent
 * (scripts/axon-social-media-research.mjs → NI-Brain `Decisions`, each row prefixed
 * "[AXON Social Media Research, <date>] <brand>: ..."). Surfaced in the research panel and folded
 * into the research prompt so the in-app report actually reflects AXON's competitor/trend work.
 */
export async function fetchRecentAxonMatchFitFindings(limit = 5): Promise<
  Array<{ id: string; text: string; date: string | null }>
> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("Decisions")
    .select("id, decision, date, created_at")
    .ilike("decision", "%AXON Social Media Research%")
    .or("decision.ilike.%Match Fit%,decision.ilike.%match-fit%")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((row) => ({
    id: String(row.id),
    text: String(row.decision ?? "").trim(),
    date: (row.date as string | null) ?? (row.created_at as string | null) ?? null,
  }));
}

/** Marks a running research run complete and attaches its report. */
export async function completeResearchRun(args: {
  id: string;
  summary: string;
  reportBody: string;
  model: string | null;
}): Promise<ContentResearchRunRow> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_research_runs")
    .update({
      status: "complete",
      summary: args.summary,
      report_body: args.reportBody,
      model: args.model,
      completed_at: new Date().toISOString(),
    })
    .eq("id", args.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ContentResearchRunRow;
}

/** Marks a running research run failed with the reason. */
export async function failResearchRun(args: { id: string; error: string }): Promise<void> {
  const client = createNiBrainClient();
  const { error } = await client
    .from("match_fit_content_research_runs")
    .update({ status: "failed", error: args.error, completed_at: new Date().toISOString() })
    .eq("id", args.id);
  if (error) throw new Error(error.message);
}

/** Most recent completed runs, newest first. Defaults to 5 — the "recent research" strip. */
export async function listRecentResearchRuns(limit = 5): Promise<ContentResearchRunRow[]> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_research_runs")
    .select("*")
    .eq("status", "complete")
    .order("run_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ContentResearchRunRow[];
}

/** Distinct year/month buckets that have at least one completed run, newest first — for an archive picker. */
export async function listResearchRunArchiveMonths(): Promise<{ year: number; month: number; count: number }[]> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_research_runs")
    .select("run_date")
    .eq("status", "complete");
  if (error) throw new Error(error.message);

  const counts = new Map<string, { year: number; month: number; count: number }>();
  for (const row of (data ?? []) as { run_date: string }[]) {
    if (!row.run_date) continue;
    const [yearStr, monthStr] = row.run_date.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!Number.isFinite(year) || !Number.isFinite(month)) continue;
    const key = `${year}-${month}`;
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { year, month, count: 1 });
  }
  return [...counts.values()].sort((a, b) => (a.year !== b.year ? b.year - a.year : b.month - a.month));
}

/** Every research run in a given ET calendar month (1-12), newest first. */
export async function listResearchRunsForMonth(year: number, month: number): Promise<ContentResearchRunRow[]> {
  const client = createNiBrainClient();
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  // Exclusive upper bound: the first day of the following month, computed via Date.UTC's natural
  // month rollover (month is 1-indexed here, Date.UTC takes 0-indexed, so passing `month` as-is
  // already lands on next month's day 1).
  const nextMonth = new Date(Date.UTC(year, month, 1));
  const end = `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, "0")}-${String(nextMonth.getUTCDate()).padStart(2, "0")}`;

  const { data, error } = await client
    .from("match_fit_content_research_runs")
    .select("*")
    .gte("run_date", start)
    .lt("run_date", end)
    .order("run_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ContentResearchRunRow[];
}

/** Every research run for one exact ET calendar date (YYYY-MM-DD), newest first. */
export async function listResearchRunsForDate(runDate: string): Promise<ContentResearchRunRow[]> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_research_runs")
    .select("*")
    .eq("run_date", runDate)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ContentResearchRunRow[];
}

export async function getResearchRun(id: string): Promise<ContentResearchRunRow | null> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_research_runs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as ContentResearchRunRow | null;
}
