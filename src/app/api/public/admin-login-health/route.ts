import { countAdministrators, probeAdministratorRead } from "@/lib/ensure-admin-portal-schema";
import { directPostgresUrlSource } from "@/lib/direct-postgres-ddl";
import { isSupabaseDirectDbHost, isSupabasePoolerHost } from "@/lib/supabase-database-url";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin-client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Public health check for administrator sign-in DB readiness (no secrets). */
export async function GET() {
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  const directUrl = process.env.DIRECT_URL?.trim() ?? "";
  const databaseUrlConfigured = Boolean(databaseUrl);
  const authSecretConfigured = Boolean(process.env.AUTH_SECRET?.trim() && process.env.AUTH_SECRET.trim().length >= 32);
  const readProbe = await probeAdministratorRead();
  let administratorCount = 0;
  let countError: string | null = null;
  if (readProbe.ok) {
    try {
      administratorCount = await countAdministrators();
    } catch (e) {
      countError = e instanceof Error ? e.message : String(e);
    }
  }

  const databaseUrlUsesSupabaseDirectHost = databaseUrl ? isSupabaseDirectDbHost(databaseUrl) : false;
  const directUrlLooksLikePooler = directUrl ? isSupabasePoolerHost(directUrl) : false;
  const databaseUrlLooksLikePooler = databaseUrl ? isSupabasePoolerHost(databaseUrl) : false;

  const healthy = databaseUrlConfigured && authSecretConfigured && readProbe.ok && !countError;

  let message: string;
  if (healthy && administratorCount === 0) {
    message =
      "Administrator database access works, but no administrator accounts exist yet. Request access at /admin/sign-up or run the bootstrap admin script.";
  } else if (healthy) {
    message = "Administrator sign-in database access is ready.";
  } else if (!databaseUrlConfigured) {
    message = "DATABASE_URL is missing in Vercel Production environment variables.";
  } else if (!readProbe.ok) {
    message = `Administrator table probe failed: ${readProbe.message.slice(0, 240)}`;
  } else if (!authSecretConfigured) {
    message = "AUTH_SECRET is missing or too short — administrator sessions cannot be signed.";
  } else if (databaseUrlUsesSupabaseDirectHost && !databaseUrlLooksLikePooler) {
    message =
      "DATABASE_URL still uses Supabase direct host (db.*.supabase.co). Runtime auto-pooler is active, but set DATABASE_URL to the transaction pooler in Vercel for reliability.";
  } else {
    message = countError ?? "Administrator sign-in health check failed.";
  }

  return NextResponse.json({
    healthy,
    databaseUrlConfigured,
    databaseUrlUsesSupabaseDirectHost,
    databaseUrlLooksLikePooler,
    directUrlLooksLikePooler,
    directPostgresUrlSource: directPostgresUrlSource(),
    authSecretConfigured,
    administratorTableReadable: readProbe.ok,
    administratorReadProbeError: readProbe.ok ? null : readProbe.message,
    administratorCount,
    countError,
    supabaseAdminConfigured: isSupabaseAdminConfigured(),
    deployCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    message,
  });
}
