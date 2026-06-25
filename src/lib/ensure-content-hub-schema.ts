import "server-only";

import pg from "pg";
import { createNiBrainClient } from "@/lib/ni-brain-client";
import { resolveNiBrainDatabaseUrlForDdl } from "@/lib/ni-brain-database-url";
import { pgPoolConfigForConnectionString } from "@/lib/supabase-database-url";

const CONTENT_HUB_COLUMNS = [
  "saved_to_hub_at",
  "is_scheduled",
  "purge_after_at",
  "bulk_session_id",
  "deleted_at",
] as const;

const CONTENT_HUB_MIGRATION_SQL = `
ALTER TABLE match_fit_content_calendar_posts
  ADD COLUMN IF NOT EXISTS saved_to_hub_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_scheduled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS purge_after_at timestamptz,
  ADD COLUMN IF NOT EXISTS bulk_session_id text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

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

/** True when NI Brain/PostgREST reports Content Hub columns are absent. */
export function isMissingContentHubSchemaError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  if (/Content Hub columns are missing|NI_BRAIN_DATABASE_URL|NI_BRAIN_DATABASE_PASSWORD/i.test(message)) return true;
  if (!CONTENT_HUB_COLUMNS.some((column) => message.includes(column))) return false;
  return (
    /does not exist|42703|PGRST204|schema cache/i.test(message) ||
    /Could not find the 'saved_to_hub_at' column/i.test(message)
  );
}

async function probeContentHubSchema(): Promise<boolean> {
  const client = createNiBrainClient();
  const { error } = await client
    .from("match_fit_content_calendar_posts")
    .select("saved_to_hub_at, is_scheduled, purge_after_at, bulk_session_id, deleted_at")
    .limit(1);

  return !error;
}

async function runNiBrainContentHubDdl(): Promise<void> {
  const { hydratePlatformEnvFromDatabase } = await import("@/lib/hydrate-platform-env");
  await hydratePlatformEnvFromDatabase();

  const databaseUrl = resolveNiBrainDatabaseUrlForDdl();
  if (!databaseUrl) {
    throw new Error(
      "Content Hub columns are missing on NI Brain. Add NI_BRAIN_DATABASE_URL or NI_BRAIN_DATABASE_PASSWORD to Vercel env or platform_secrets (Supabase → Settings → Database), then redeploy — or run: npm run migrate:ni-brain-content-hub",
    );
  }

  const pool = new pg.Pool({
    ...pgPoolConfigForConnectionString(databaseUrl),
    max: 1,
  });

  try {
    await pool.query(CONTENT_HUB_MIGRATION_SQL);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/tenant\/user|ENOTFOUND|pooler/i.test(message)) {
      throw new Error(
        `Content Hub schema repair could not reach NI Brain Postgres (${message}). ` +
          "Use a direct db.<project-ref>.supabase.co URL for NI_BRAIN_DATABASE_URL, or set NI_BRAIN_DATABASE_PASSWORD with NI_BRAIN_SUPABASE_URL.",
      );
    }
    throw e;
  } finally {
    await pool.end().catch(() => {});
  }
}

/**
 * Applies Content Hub DDL on NI Brain when production missed scripts/ni-brain-content-hub-migration.sql.
 */
export async function ensureContentHubSchema(): Promise<void> {
  if (await probeContentHubSchema()) return;

  await runNiBrainContentHubDdl();

  if (!(await probeContentHubSchema())) {
    throw new Error(
      "Content Hub columns are still missing on NI Brain after migration. Confirm NI_BRAIN_DATABASE_URL points at project kxijunwgbrlfzvgkhklo, then redeploy.",
    );
  }
}
