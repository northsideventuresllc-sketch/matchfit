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
  // Stamp dispatched_at on ANY move off "queued", not only the "dispatched"
  // status. Nothing ever wrote that status, so the queue had no liveness
  // signal at all and a stalled runner looked identical to an idle one.
  if (args.status !== "queued") patch.dispatched_at = now;
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

export async function updateCoworkJobBrief(jobId: string, brief: Record<string, unknown>): Promise<void> {
  const client = createNiBrainClient();
  const { error } = await client
    .from("match_fit_content_cowork_jobs")
    .update({ brief })
    .eq("id", jobId);
  if (error) throw new Error(error.message);
}

export async function getPendingCoworkJobs(jobType?: CoworkJobType): Promise<CoworkJobRow[]> {
  const client = createNiBrainClient();
  let query = client
    .from("match_fit_content_cowork_jobs")
    .select("*")
    .eq("status", "queued");
  if (jobType) query = query.eq("job_type", jobType);
  const { data, error } = await query.order("created_at", { ascending: true });
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

/** Resolved retention windows — settings row when present, otherwise defaults. */
export async function resolveRetentionSettings(): Promise<{
  postedRetentionHours: number;
  scrappedRetentionDays: number;
}> {
  const settings = await getContentCalendarSettings();
  return {
    postedRetentionHours: settings?.posted_retention_hours ?? CONTENT_CALENDAR_SETTINGS_DEFAULTS.posted_retention_hours,
    scrappedRetentionDays: settings?.scrapped_retention_days ?? CONTENT_CALENDAR_SETTINGS_DEFAULTS.scrapped_retention_days,
  };
}

/**
 * Purge timestamp for an archived post — `posted` archives use the hours window, `scrapped`
 * archives use the days window. Shared by both archive paths so the retention math lives in one
 * place.
 */
export async function resolveArchivePurgeAfter(
  archiveType: "posted" | "scrapped",
  now: Date = new Date(),
): Promise<string> {
  const { postedRetentionHours, scrappedRetentionDays } = await resolveRetentionSettings();
  const ms =
    archiveType === "posted"
      ? postedRetentionHours * 60 * 60 * 1000
      : scrappedRetentionDays * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() + ms).toISOString();
}

/**
 * Mac Mini download folder convention for Cowork-generated media. Configurable because JB's exact
 * folder name is unknown; defaults to a "Social Media" subfolder inside a "Match Fit" folder.
 */
export function getCoworkMediaDownloadFolder(): string {
  return process.env.MATCH_FIT_COWORK_MEDIA_FOLDER?.trim() || "Match Fit/Social Media";
}

/** Priority order for a day's media generation — video first per spec. */
export const COWORK_MEDIA_GENERATION_ORDER = ["video", "static", "carousel"] as const;

export type CoworkMediaOrderKey = (typeof COWORK_MEDIA_GENERATION_ORDER)[number];

/**
 * Routing note so the Cowork poster sends TikTok video through TikTok Studio, where scheduled
 * posting works under 1K followers (the regular app does not offer it).
 */
export const COWORK_TIKTOK_VIDEO_NOTE =
  "TikTok video posts must be published via TikTok Studio (studio.tiktok.com), not the regular TikTok app — scheduled posting is unavailable in the app under 1,000 followers.";

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
