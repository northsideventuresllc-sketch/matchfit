import "server-only";

import { createNiBrainClient } from "@/lib/ni-brain-client";

export type CoworkJobType = "generate_media" | "post_batch";
export type CoworkJobStatus = "queued" | "dispatched" | "running" | "complete" | "failed";

export type CoworkJobRow = {
  id: string;
  job_type: CoworkJobType;
  brief: Record<string, unknown>;
  status: CoworkJobStatus;
  platform_targets: string[] | null;
  created_at: string;
  dispatched_at: string | null;
  completed_at: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
};

export type ContentCalendarSettingsRow = {
  id: string;
  posted_retention_hours: number;
  scrapped_retention_days: number;
  updated_at: string;
};

export type ProductScoreboardRow = {
  product_slug: string;
  signups: number;
  paid: number;
  mrr: number;
  phase: string | null;
  updated_at: string;
};

export const CONTENT_CALENDAR_SETTINGS_DEFAULTS = {
  posted_retention_hours: 48,
  scrapped_retention_days: 7,
} as const;

export async function createCoworkJob(args: {
  jobType: CoworkJobType;
  brief: Record<string, unknown>;
  platformTargets?: string[] | null;
}): Promise<CoworkJobRow> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_cowork_jobs")
    .insert({
      job_type: args.jobType,
      brief: args.brief,
      status: "queued",
      platform_targets: args.platformTargets ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as CoworkJobRow;
}

export async function updateCoworkJobStatus(args: {
  jobId: string;
  status: CoworkJobStatus;
  result?: Record<string, unknown> | null;
  error?: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: args.status };
  if (args.status === "dispatched") patch.dispatched_at = now;
  if (args.status === "complete" || args.status === "failed") patch.completed_at = now;
  if (args.result !== undefined) patch.result = args.result;
  if (args.error !== undefined) patch.error = args.error;

  const client = createNiBrainClient();
  const { error } = await client
    .from("match_fit_content_cowork_jobs")
    .update(patch)
    .eq("id", args.jobId);
  if (error) throw new Error(error.message);
}

export async function getPendingCoworkJobs(): Promise<CoworkJobRow[]> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_cowork_jobs")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CoworkJobRow[];
}

export async function getCoworkJob(jobId: string): Promise<CoworkJobRow | null> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_cowork_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as CoworkJobRow | null;
}

export async function getContentCalendarSettings(): Promise<ContentCalendarSettingsRow | null> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_calendar_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as ContentCalendarSettingsRow | null;
}

export async function updateContentCalendarSettings(args: {
  postedRetentionHours?: number;
  scrappedRetentionDays?: number;
}): Promise<ContentCalendarSettingsRow> {
  const client = createNiBrainClient();
  const existing = await getContentCalendarSettings();
  const now = new Date().toISOString();

  if (existing) {
    const patch: Record<string, unknown> = { updated_at: now };
    if (args.postedRetentionHours !== undefined) patch.posted_retention_hours = args.postedRetentionHours;
    if (args.scrappedRetentionDays !== undefined) patch.scrapped_retention_days = args.scrappedRetentionDays;

    const { data, error } = await client
      .from("match_fit_content_calendar_settings")
      .update(patch)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as ContentCalendarSettingsRow;
  }

  const { data, error } = await client
    .from("match_fit_content_calendar_settings")
    .insert({
      posted_retention_hours: args.postedRetentionHours ?? CONTENT_CALENDAR_SETTINGS_DEFAULTS.posted_retention_hours,
      scrapped_retention_days: args.scrappedRetentionDays ?? CONTENT_CALENDAR_SETTINGS_DEFAULTS.scrapped_retention_days,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ContentCalendarSettingsRow;
}

export async function getMatchFitDpmoPhase(): Promise<string | null> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("product_scoreboard")
    .select("phase")
    .eq("product_slug", "match-fit")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.phase as string | null) ?? null;
}
