import {
  CLIENT_PLATFORM_TRIAL_DDL,
  countClientPlatformTrialColumns,
} from "@/lib/ensure-client-platform-trial-schema";
import { directPostgresUrlForDdl, directPostgresUrlSource } from "@/lib/direct-postgres-ddl";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Public health check for client sign-up DB readiness (no secrets exposed).
 * Use after deploy to confirm trial columns exist on production.
 */
export async function GET() {
  const directUrlSource = directPostgresUrlSource();
  const directUrlConfigured = directUrlSource !== "missing";
  const databaseUrlConfigured = Boolean(process.env.DATABASE_URL?.trim());

  let trialColumnsFound = 0;
  let schemaCheckError: string | null = null;
  try {
    trialColumnsFound = await countClientPlatformTrialColumns();
  } catch (e) {
    schemaCheckError = e instanceof Error ? e.message : String(e);
  }

  const healthy = databaseUrlConfigured && directUrlConfigured && trialColumnsFound >= 4;

  let message: string;
  if (healthy) {
    message = "Client sign-up schema is ready.";
  } else if (!databaseUrlConfigured) {
    message = "DATABASE_URL is missing in Vercel Production environment variables.";
  } else if (!directUrlConfigured) {
    message =
      "DIRECT_URL is missing and could not be derived from DATABASE_URL. Add Supabase DIRECT_URL (port 5432) in Vercel Production.";
  } else if (trialColumnsFound < 4) {
    message = `Client trial columns are missing (${trialColumnsFound}/4). The next sign-up attempt should auto-repair; if not, run npm run db:migrate against production.`;
  } else {
    message = "Client sign-up schema check failed.";
  }

  return NextResponse.json({
    healthy,
    databaseUrlConfigured,
    directUrlConfigured,
    directUrlSource,
    directHost: safeHostFromUrl(directPostgresUrlForDdl()),
    trialColumnsFound,
    trialColumnsRequired: 4,
    schemaCheckError,
    deployCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    message,
    repairSqlStatementCount: CLIENT_PLATFORM_TRIAL_DDL.split("ALTER TABLE").length - 1,
  });
}

function safeHostFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
  } catch {
    return null;
  }
}
