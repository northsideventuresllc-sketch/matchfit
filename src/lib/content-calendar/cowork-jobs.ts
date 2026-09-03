import "server-only";

import { createNiBrainClient } from "@/lib/ni-brain-client";

export type MediaAgentJobType = "generate_media" | "post_batch";
export type MediaAgentJobStatus = "queued" | "dispatched" | "running" | "complete" | "failed";

export type MediaAgentJobRow = {
  id: string;
  job_type: MediaAgentJobType;
  brief: Record<string, unknown>;
  status: MediaAgentJobStatus;
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

/** Table name kept as `match_fit_content_cowork_jobs` on purpose — it's the live NI-Brain
 * Supabase table; renaming it is a schema migration, out of scope for the naming cleanup that
 * renamed every code-facing symbol here (2026-09-02, JB direct: "cowork is not part of the loop
 * anymore" — this table never held an actual Claude Cowork session, only job-history rows for
 * the real Mac-mini browser agent below). */
export async function createMediaAgentJob(args: {
  jobType: MediaAgentJobType;
  brief: Record<string, unknown>;
  platformTargets?: string[] | null;
}): Promise<MediaAgentJobRow> {
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
  return data as MediaAgentJobRow;
}

/**
 * Fires the real browser-driven media generator on JB's Mac mini for the given posts —
 * scripts/gemini-media-automation.mjs, which drives the Gemini web app over CDP/Playwright
 * (dedicated automation Chrome profile, JB's own logged-in Gemini session) and writes real
 * images back onto match_fit_content_calendar_posts. This is the only generation path that
 * actually produces media: the Gemini Developer API key behind the REST cron
 * (content-calendar/media-generation.ts) has zero free-tier image/video quota — confirmed
 * live 2026-08-04 (nv-vault scripts/media/README-mf-media-drain.md) and re-confirmed
 * 2026-09-02 — so that path can never succeed regardless of model choice or retry count.
 *
 * Queues into nvg_mini_jobs (NI-Brain), kind="shell" — the only kind the mini's runner
 * executes. The mini's own job-queue runner (liveness in nvg_mini_heartbeat) claims and
 * runs this independently of whether this session or any live browser-tool bridge is
 * connected — this is what makes "press the button, the agent goes and does it" real. No
 * Claude Cowork AI session is involved anywhere in this path — this IS the agent: a script on
 * JB's own Mac mini driving Chrome directly via CDP (desktop-level browser control).
 */
export async function queueMiniChromeAgentJob(args: { ids: string[]; title: string }): Promise<void> {
  if (!args.ids.length) return;
  const client = createNiBrainClient();
  const cmd = `cd $HOME/nvg-gemini-automation && node gemini-media-automation.mjs --ids=${args.ids.join(",")} 2>&1`;
  const { error } = await client.from("nvg_mini_jobs").insert({
    kind: "shell",
    title: args.title,
    payload: { cmd, timeout: 600 },
  });
  if (error) throw new Error(`queueMiniChromeAgentJob failed: ${error.message}`);
}

/** "Live" nvg_mini_jobs statuses — anything not yet resolved one way or the other. */
const LIVE_MINI_JOB_STATUSES = ["queued", "blocked_needs_jb"];

/**
 * True when a not-yet-resolved nvg_mini_jobs shell row already references this post id in its
 * `payload.cmd` (queueMiniChromeAgentJob's `--ids=...` argument). Used so re-queueing logic
 * (e.g. the generate-media cron drain) never double-queues a post the mini is already about to
 * pick up or is stuck on pending JB.
 */
export async function hasLiveMiniJobForPost(postId: string): Promise<boolean> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("nvg_mini_jobs")
    .select("id")
    .eq("kind", "shell")
    .in("status", LIVE_MINI_JOB_STATUSES)
    .ilike("payload->>cmd", `%${postId}%`)
    .limit(1);
  if (error) throw new Error(`hasLiveMiniJobForPost failed: ${error.message}`);
  return Boolean(data?.length);
}

export async function updateMediaAgentJobStatus(args: {
  jobId: string;
  status: MediaAgentJobStatus;
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

export async function updateMediaAgentJobBrief(jobId: string, brief: Record<string, unknown>): Promise<void> {
  const client = createNiBrainClient();
  const { error } = await client
    .from("match_fit_content_cowork_jobs")
    .update({ brief })
    .eq("id", jobId);
  if (error) throw new Error(error.message);
}

export async function getPendingMediaAgentJobs(jobType?: MediaAgentJobType): Promise<MediaAgentJobRow[]> {
  const client = createNiBrainClient();
  let query = client
    .from("match_fit_content_cowork_jobs")
    .select("*")
    .eq("status", "queued");
  if (jobType) query = query.eq("job_type", jobType);
  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MediaAgentJobRow[];
}

export async function getMediaAgentJob(jobId: string): Promise<MediaAgentJobRow | null> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_cowork_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as MediaAgentJobRow | null;
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
 * Mac Mini download folder convention for media-agent-generated media. Configurable because JB's
 * exact folder name is unknown; defaults to a "Social Media" subfolder inside a "Match Fit"
 * folder. Env var name kept as MATCH_FIT_COWORK_MEDIA_FOLDER on purpose — it's a live Vercel prod
 * setting; renaming it needs a coordinated env-var update there, out of scope for this pass.
 */
export function getMediaAgentDownloadFolder(): string {
  return process.env.MATCH_FIT_COWORK_MEDIA_FOLDER?.trim() || "Match Fit/Social Media";
}

/** Priority order for a day's media generation — video first per spec. */
export const MEDIA_AGENT_GENERATION_ORDER = ["video", "static", "carousel"] as const;

export type MediaAgentOrderKey = (typeof MEDIA_AGENT_GENERATION_ORDER)[number];

/**
 * Routing note so the media agent's poster sends TikTok video through TikTok Studio, where
 * scheduled posting works under 1K followers (the regular app does not offer it).
 */
export const MEDIA_AGENT_TIKTOK_VIDEO_NOTE =
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
