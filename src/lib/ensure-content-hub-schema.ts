import "server-only";

import pg from "pg";
import { createNiBrainClient } from "@/lib/ni-brain-client";
import {
  resolveNiBrainDatabaseUrlFallbackForDdl,
  resolveNiBrainDatabaseUrlForDdl,
} from "@/lib/ni-brain-database-url";
import { pgPoolConfigForConnectionString } from "@/lib/supabase-database-url";

const CONTENT_HUB_COLUMNS = [
  "saved_to_hub_at",
  "is_scheduled",
  "purge_after_at",
  "bulk_session_id",
  "deleted_at",
] as const;

const CONTENT_CALENDAR_V2_COLUMNS = [
  "theme",
  "cta",
  "content_lane",
  "workflow_stage",
  "platform_captions",
  "platform_hashtags",
  "optimize_status",
  "optimize_error",
  "optimize_started_at",
  "media_urls",
  "archived_at",
] as const;

const CONTENT_HUB_MIGRATION_SQL = `
ALTER TABLE match_fit_content_calendar_posts
  ADD COLUMN IF NOT EXISTS saved_to_hub_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_scheduled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS purge_after_at timestamptz,
  ADD COLUMN IF NOT EXISTS bulk_session_id text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Unscheduled hub drafts may omit a post date until the operator sets one.
ALTER TABLE match_fit_content_calendar_posts
  ALTER COLUMN post_date DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_calendar_saved_hub
  ON match_fit_content_calendar_posts (saved_to_hub_at)
  WHERE saved_to_hub_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_calendar_purge
  ON match_fit_content_calendar_posts (purge_after_at)
  WHERE purge_after_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_calendar_deleted
  ON match_fit_content_calendar_posts (deleted_at)
  WHERE deleted_at IS NOT NULL;
`;

const CONTENT_CALENDAR_V2_MIGRATION_SQL = `
ALTER TABLE match_fit_content_calendar_posts
  ADD COLUMN IF NOT EXISTS theme text,
  ADD COLUMN IF NOT EXISTS cta text,
  ADD COLUMN IF NOT EXISTS content_lane text,
  ADD COLUMN IF NOT EXISTS workflow_stage text,
  ADD COLUMN IF NOT EXISTS platform_captions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS platform_hashtags jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS optimize_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS optimize_error text,
  ADD COLUMN IF NOT EXISTS optimize_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS media_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_content_calendar_v2_stage
  ON match_fit_content_calendar_posts (workflow_stage, content_lane, updated_at);

CREATE INDEX IF NOT EXISTS idx_content_calendar_v2_archive
  ON match_fit_content_calendar_posts (archived_at)
  WHERE archived_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_calendar_v2_optimize
  ON match_fit_content_calendar_posts (optimize_status, optimize_started_at)
  WHERE optimize_status = 'running';
`;

const CONTENT_CALENDAR_V2_1_COLUMNS = [
  "dpmo_phase",
  "dpmo_rationale",
  "social_scan_snapshot_id",
  "hashtag_research_snapshot",
] as const;

const CONTENT_CALENDAR_V2_1_MIGRATION_SQL = `
ALTER TABLE match_fit_content_calendar_posts
  ADD COLUMN IF NOT EXISTS dpmo_phase text,
  ADD COLUMN IF NOT EXISTS dpmo_rationale text,
  ADD COLUMN IF NOT EXISTS social_scan_snapshot_id text,
  ADD COLUMN IF NOT EXISTS hashtag_research_snapshot jsonb;

CREATE TABLE IF NOT EXISTS match_fit_content_cowork_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL CHECK (job_type IN ('generate_media', 'post_batch')),
  brief jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'dispatched', 'running', 'complete', 'failed')),
  platform_targets text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz,
  completed_at timestamptz,
  result jsonb,
  error text
);

CREATE INDEX IF NOT EXISTS idx_content_cowork_jobs_status
  ON match_fit_content_cowork_jobs (status);

CREATE TABLE IF NOT EXISTS match_fit_content_calendar_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_retention_hours integer NOT NULL DEFAULT 48,
  scrapped_retention_days integer NOT NULL DEFAULT 7,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_fit_content_calendar_settings_retention_bounds
    CHECK (posted_retention_hours <= 8760 AND scrapped_retention_days <= 365)
);

CREATE TABLE IF NOT EXISTS product_scoreboard (
  product_slug text PRIMARY KEY,
  signups integer NOT NULL DEFAULT 0,
  paid integer NOT NULL DEFAULT 0,
  mrr numeric NOT NULL DEFAULT 0,
  phase text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO product_scoreboard (product_slug, phase)
  VALUES ('match-fit', 'phase1')
  ON CONFLICT (product_slug) DO NOTHING;
`;

const CONTENT_CALENDAR_V2_2_COLUMNS = ["archive_type", "scrap_reason", "posted_urls"] as const;

const CONTENT_CALENDAR_V2_2_MIGRATION_SQL = `
ALTER TABLE match_fit_content_calendar_posts
  ADD COLUMN IF NOT EXISTS archive_type text,
  ADD COLUMN IF NOT EXISTS scrap_reason text,
  ADD COLUMN IF NOT EXISTS posted_urls jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_content_calendar_v2_archive_type
  ON match_fit_content_calendar_posts (archive_type)
  WHERE archive_type IS NOT NULL;
`;

const CONTENT_CALENDAR_V2_3_COLUMNS = [
  "last_generation_prompt",
  "media_generation_started_at",
  "generation_source",
] as const;

const CONTENT_CALENDAR_V2_3_MIGRATION_SQL = `
ALTER TABLE match_fit_content_calendar_posts
  ADD COLUMN IF NOT EXISTS last_generation_prompt text,
  ADD COLUMN IF NOT EXISTS media_generation_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS generation_source text;

CREATE TABLE IF NOT EXISTS match_fit_content_research_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','complete','failed')),
  trigger text NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual','scheduled')),
  run_date date NOT NULL,
  summary text,
  report_body text,
  model text,
  error text,
  admin_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_content_research_runs_date
  ON match_fit_content_research_runs (run_date DESC, created_at DESC);
`;

const CONTENT_CALENDAR_V2_4_COLUMNS = [
  "media_progress",
  "media_progress_stage",
  "media_progress_updated_at",
  "posted_retain_until",
] as const;

const CONTENT_CALENDAR_V2_4_MIGRATION_SQL = `
ALTER TABLE match_fit_content_calendar_posts
  ADD COLUMN IF NOT EXISTS media_progress integer,
  ADD COLUMN IF NOT EXISTS media_progress_stage text,
  ADD COLUMN IF NOT EXISTS media_progress_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS posted_retain_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_content_calendar_v2_posted_retain
  ON match_fit_content_calendar_posts (posted_retain_until)
  WHERE posted_retain_until IS NOT NULL;
`;

const POST_DATE_NULLABLE_SQL = `
ALTER TABLE match_fit_content_calendar_posts
  ALTER COLUMN post_date DROP NOT NULL;
`;

let postDateNullabilityEnsured = false;

/** True when NI Brain/PostgREST reports Content Hub columns are absent. */
export function isMissingContentHubSchemaError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  if (/Content Hub columns are missing|NI_BRAIN_DATABASE_URL|NI_BRAIN_DATABASE_PASSWORD/i.test(message)) return true;
  const knownColumns = [...CONTENT_HUB_COLUMNS, ...CONTENT_CALENDAR_V2_COLUMNS];
  if (!knownColumns.some((column) => message.includes(column))) return false;
  return (
    /does not exist|42703|PGRST204|schema cache/i.test(message) ||
    /Could not find the 'saved_to_hub_at' column/i.test(message)
  );
}

export function isMissingContentCalendarV2SchemaError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  if (/Content Calendar v2 columns are missing/i.test(message)) return true;
  if (!CONTENT_CALENDAR_V2_COLUMNS.some((column) => message.includes(column))) return isMissingContentHubSchemaError(e);
  return /does not exist|42703|PGRST204|schema cache/i.test(message);
}

export function isMissingContentCalendarV21SchemaError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  if (/Content Calendar v2\.1 schema is missing/i.test(message)) return true;
  const mentioned =
    CONTENT_CALENDAR_V2_1_COLUMNS.some((column) => message.includes(column)) ||
    message.includes("match_fit_content_cowork_jobs") ||
    message.includes("match_fit_content_calendar_settings") ||
    message.includes("product_scoreboard");
  if (!mentioned) return isMissingContentCalendarV2SchemaError(e);
  return /does not exist|42P01|42703|PGRST204|schema cache/i.test(message);
}

export function isMissingContentCalendarV22SchemaError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  if (/Content Calendar v2\.2 schema is missing/i.test(message)) return true;
  if (!CONTENT_CALENDAR_V2_2_COLUMNS.some((column) => message.includes(column))) {
    return isMissingContentCalendarV21SchemaError(e);
  }
  return /does not exist|42P01|42703|PGRST204|schema cache/i.test(message);
}

export function isMissingContentCalendarV23SchemaError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  if (/Content Calendar v2\.3 schema is missing/i.test(message)) return true;
  const mentioned =
    CONTENT_CALENDAR_V2_3_COLUMNS.some((column) => message.includes(column)) ||
    message.includes("match_fit_content_research_runs");
  if (!mentioned) return isMissingContentCalendarV22SchemaError(e);
  return /does not exist|42P01|42703|PGRST204|schema cache/i.test(message);
}

export function isMissingContentCalendarV24SchemaError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  if (/Content Calendar v2\.4 schema is missing/i.test(message)) return true;
  if (!CONTENT_CALENDAR_V2_4_COLUMNS.some((column) => message.includes(column))) {
    return isMissingContentCalendarV23SchemaError(e);
  }
  return /does not exist|42P01|42703|PGRST204|schema cache/i.test(message);
}

function isConnectivityError(message: string): boolean {
  return /tenant\/user|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|Network is unreachable|pooler/i.test(
    message,
  );
}

/** Postgres rejected the credential itself (28P01) rather than failing to reach the host. */
function isAuthError(message: string): boolean {
  return /password authentication failed|28P01/i.test(message);
}

async function probeContentHubSchema(): Promise<boolean> {
  const client = createNiBrainClient();
  const { error } = await client
    .from("match_fit_content_calendar_posts")
    .select("saved_to_hub_at, is_scheduled, purge_after_at, bulk_session_id, deleted_at")
    .limit(1);

  return !error;
}

async function probeContentCalendarV2Schema(): Promise<boolean> {
  const client = createNiBrainClient();
  const { error } = await client
    .from("match_fit_content_calendar_posts")
    .select(
      [
        "theme",
        "cta",
        "content_lane",
        "workflow_stage",
        "platform_captions",
        "platform_hashtags",
        "optimize_status",
        "optimize_error",
        "optimize_started_at",
        "media_urls",
        "archived_at",
      ].join(", "),
    )
    .limit(1);

  return !error;
}

async function probeContentCalendarV21Schema(): Promise<boolean> {
  const client = createNiBrainClient();
  const { error: postsError } = await client
    .from("match_fit_content_calendar_posts")
    .select("dpmo_phase, dpmo_rationale, social_scan_snapshot_id, hashtag_research_snapshot")
    .limit(1);
  if (postsError) return false;

  const { error: jobsError } = await client
    .from("match_fit_content_cowork_jobs")
    .select("id, job_type, brief, status, platform_targets, result, error")
    .limit(1);
  if (jobsError) return false;

  const { error: settingsError } = await client
    .from("match_fit_content_calendar_settings")
    .select("id, posted_retention_hours, scrapped_retention_days")
    .limit(1);
  if (settingsError) return false;

  const { error: scoreboardError } = await client
    .from("product_scoreboard")
    .select("product_slug, signups, paid, mrr, phase")
    .limit(1);
  return !scoreboardError;
}

async function probeContentCalendarV22Schema(): Promise<boolean> {
  const client = createNiBrainClient();
  const { error } = await client
    .from("match_fit_content_calendar_posts")
    .select("archive_type, scrap_reason, posted_urls")
    .limit(1);
  return !error;
}

async function probeContentCalendarV23Schema(): Promise<boolean> {
  const client = createNiBrainClient();
  const { error: postsError } = await client
    .from("match_fit_content_calendar_posts")
    .select("last_generation_prompt, media_generation_started_at, generation_source")
    .limit(1);
  if (postsError) return false;

  const { error: runsError } = await client
    .from("match_fit_content_research_runs")
    .select("id, status, trigger, run_date, summary, report_body, model, error, admin_id")
    .limit(1);
  return !runsError;
}

async function probeContentCalendarV24Schema(): Promise<boolean> {
  const client = createNiBrainClient();
  const { error } = await client
    .from("match_fit_content_calendar_posts")
    .select("media_progress, media_progress_stage, media_progress_updated_at, posted_retain_until")
    .limit(1);
  return !error;
}

async function runSqlOnUrl(databaseUrl: string, sql: string): Promise<void> {
  const pool = new pg.Pool({
    ...pgPoolConfigForConnectionString(databaseUrl),
    max: 1,
  });

  try {
    await pool.query(sql);
  } finally {
    await pool.end().catch(() => {});
  }
}

async function runNiBrainDdl(sql: string): Promise<void> {
  const { hydratePlatformEnvFromDatabase } = await import("@/lib/hydrate-platform-env");
  await hydratePlatformEnvFromDatabase();

  const databaseUrl = resolveNiBrainDatabaseUrlForDdl();
  if (!databaseUrl) {
    throw new Error(
      "Content Hub columns are missing on NI Brain. Add NI_BRAIN_DATABASE_URL or NI_BRAIN_DATABASE_PASSWORD to Vercel env or platform_secrets (Supabase → Settings → Database), then redeploy — or run: npm run migrate:ni-brain-content-hub",
    );
  }

  try {
    await runSqlOnUrl(databaseUrl, sql);
    return;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const fallbackUrl = isConnectivityError(message)
      ? resolveNiBrainDatabaseUrlFallbackForDdl(databaseUrl)
      : null;

    if (fallbackUrl) {
      try {
        console.warn(
          "[content-hub] primary NI Brain DDL host failed; retrying session/direct fallback",
          message,
        );
        await runSqlOnUrl(fallbackUrl, sql);
        return;
      } catch (fallbackErr) {
        const fallbackMessage = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        throw new Error(
          `Content Hub schema repair could not reach NI Brain Postgres (${fallbackMessage}). ` +
            "Set NI_BRAIN_DATABASE_PASSWORD with NI_BRAIN_SUPABASE_URL, or NI_BRAIN_DATABASE_URL to the session pooler " +
            "(aws-1-us-east-1.pooler.supabase.com:5432). Direct db.<ref>.supabase.co is IPv6-only on many hosts.",
        );
      }
    }

    if (isConnectivityError(message)) {
      throw new Error(
        `Content Hub schema repair could not reach NI Brain Postgres (${message}). ` +
          "Set NI_BRAIN_DATABASE_PASSWORD with NI_BRAIN_SUPABASE_URL, or NI_BRAIN_DATABASE_URL to the session pooler " +
          "(aws-1-us-east-1.pooler.supabase.com:5432). Direct db.<ref>.supabase.co is IPv6-only on many hosts.",
      );
    }

    if (isAuthError(message)) {
      throw new Error(
        "Content Hub schema repair could not authenticate to NI Brain Postgres — the stored " +
          "NI_BRAIN_DATABASE_PASSWORD no longer matches the database. Update it in platform_secrets " +
          "(or set NI_BRAIN_DATABASE_URL) with the current password from Supabase → Settings → Database, then retry.",
      );
    }
    throw e;
  }
}

async function ensurePostDateNullable(): Promise<void> {
  if (postDateNullabilityEnsured) return;

  const { hydratePlatformEnvFromDatabase } = await import("@/lib/hydrate-platform-env");
  await hydratePlatformEnvFromDatabase();
  const databaseUrl = resolveNiBrainDatabaseUrlForDdl();
  // Without a DDL URL we cannot alter the column — save paths still use null for unscheduled posts.
  if (!databaseUrl) {
    postDateNullabilityEnsured = true;
    return;
  }

  try {
    await runNiBrainDdl(POST_DATE_NULLABLE_SQL);
  } catch (e) {
    // Hub columns already exist; nullability is best-effort. Don't block Content Hub on DNS failures.
    console.warn("[content-hub] post_date nullability ensure skipped", e);
  }
  postDateNullabilityEnsured = true;
}

/**
 * Applies Content Hub DDL on NI Brain when production missed scripts/ni-brain-content-hub-migration.sql.
 * Also ensures post_date can be NULL for unscheduled hub drafts.
 */
export async function ensureContentHubSchema(): Promise<void> {
  if (!(await probeContentHubSchema())) {
    await runNiBrainDdl(CONTENT_HUB_MIGRATION_SQL);
    postDateNullabilityEnsured = true;

    if (!(await probeContentHubSchema())) {
      throw new Error(
        "Content Hub columns are still missing on NI Brain after migration. Confirm NI_BRAIN_DATABASE_URL points at project kxijunwgbrlfzvgkhklo, then redeploy.",
      );
    }
    return;
  }

  await ensurePostDateNullable();
}

export async function ensureContentCalendarV2Schema(): Promise<void> {
  await ensureContentHubSchema();
  if (await probeContentCalendarV2Schema()) return;

  await runNiBrainDdl(CONTENT_CALENDAR_V2_MIGRATION_SQL);

  if (!(await probeContentCalendarV2Schema())) {
    throw new Error(
      "Content Calendar v2 columns are still missing on NI Brain after migration. Confirm NI_BRAIN_DATABASE_URL points at project kxijunwgbrlfzvgkhklo, then redeploy.",
    );
  }
}

/**
 * Applies Content Calendar v2.1 DDL on NI Brain: DPMO/social-scan/hashtag columns on
 * match_fit_content_calendar_posts plus the match_fit_content_cowork_jobs,
 * match_fit_content_calendar_settings, and product_scoreboard tables (seeding match-fit).
 */
export async function ensureContentCalendarV21Schema(): Promise<void> {
  await ensureContentCalendarV2Schema();
  if (await probeContentCalendarV21Schema()) return;

  await runNiBrainDdl(CONTENT_CALENDAR_V2_1_MIGRATION_SQL);

  if (!(await probeContentCalendarV21Schema())) {
    throw new Error(
      "Content Calendar v2.1 schema is missing on NI Brain after migration. Confirm NI_BRAIN_DATABASE_URL points at project kxijunwgbrlfzvgkhklo, then redeploy — or run: npm run migrate:ni-brain-content-calendar-v2",
    );
  }
}

/**
 * Applies Content Calendar v2.2 DDL on NI Brain: archive_type / scrap_reason (posted vs scrapped
 * archive split) and posted_urls (per-platform posted links) on match_fit_content_calendar_posts.
 */
export async function ensureContentCalendarV22Schema(): Promise<void> {
  await ensureContentCalendarV21Schema();
  if (await probeContentCalendarV22Schema()) return;

  await runNiBrainDdl(CONTENT_CALENDAR_V2_2_MIGRATION_SQL);

  if (!(await probeContentCalendarV22Schema())) {
    throw new Error(
      "Content Calendar v2.2 schema is missing on NI Brain after migration. Confirm NI_BRAIN_DATABASE_URL points at project kxijunwgbrlfzvgkhklo, then redeploy.",
    );
  }
}

/**
 * Applies Content Calendar v2.3 DDL on NI Brain: the generation-tracking columns (last prompt,
 * generation-started timestamp, generation source) on match_fit_content_calendar_posts, plus the
 * match_fit_content_research_runs table for the Social Media Research tab.
 */
export async function ensureContentCalendarV23Schema(): Promise<void> {
  await ensureContentCalendarV22Schema();
  if (await probeContentCalendarV23Schema()) return;

  await runNiBrainDdl(CONTENT_CALENDAR_V2_3_MIGRATION_SQL);

  if (!(await probeContentCalendarV23Schema())) {
    throw new Error(
      "Content Calendar v2.3 schema is missing on NI Brain after migration. Confirm NI_BRAIN_DATABASE_URL points at project kxijunwgbrlfzvgkhklo, then redeploy.",
    );
  }
}

/**
 * Applies Content Calendar v2.4 DDL on NI Brain: live media-generation progress columns
 * (media_progress / media_progress_stage / media_progress_updated_at) and posted_retain_until
 * (48h "Posted" retention on the Scheduled tab).
 */
export async function ensureContentCalendarV24Schema(): Promise<void> {
  await ensureContentCalendarV23Schema();
  if (await probeContentCalendarV24Schema()) return;

  await runNiBrainDdl(CONTENT_CALENDAR_V2_4_MIGRATION_SQL);

  if (!(await probeContentCalendarV24Schema())) {
    throw new Error(
      "Content Calendar v2.4 schema is missing on NI Brain after migration. Confirm NI_BRAIN_DATABASE_URL points at project kxijunwgbrlfzvgkhklo, then redeploy.",
    );
  }
}

/** Test-only reset for module-level migration memo. */
export function resetContentHubSchemaMemoForTests(): void {
  postDateNullabilityEnsured = false;
}
