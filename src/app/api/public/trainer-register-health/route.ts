import { isSupabaseAdminConfigured } from "@/lib/supabase/admin-client";
import { findSupabaseAuthUserByEmail } from "@/lib/supabase/find-auth-user-by-email";
import { probeTrainerRegisterInsert } from "@/lib/probe-trainer-register-insert";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Public health check for trainer sign-up DB + Supabase Auth admin readiness.
 */
export async function GET() {
  const databaseUrlConfigured = Boolean(process.env.DATABASE_URL?.trim());
  const supabaseAdminConfigured = isSupabaseAdminConfigured();

  let authLookupOk = false;
  let authLookupError: string | null = null;
  if (supabaseAdminConfigured) {
    try {
      await findSupabaseAuthUserByEmail("healthcheck-does-not-exist@internal.match-fit.invalid");
      authLookupOk = true;
    } catch (e) {
      authLookupError = e instanceof Error ? e.message : String(e);
    }
  }

  const insertProbe = await probeTrainerRegisterInsert();
  const healthy = databaseUrlConfigured && supabaseAdminConfigured && authLookupOk && insertProbe.ok;

  let message: string;
  if (healthy) {
    message = "Trainer sign-up schema and Supabase admin lookup are ready.";
  } else if (!databaseUrlConfigured) {
    message = "DATABASE_URL is missing in Vercel Production environment variables.";
  } else if (!supabaseAdminConfigured) {
    message = "SUPABASE_SERVICE_ROLE_KEY is missing — trainer finish sign-up cannot verify Supabase users.";
  } else if (!authLookupOk) {
    message = `Supabase admin user lookup failed${authLookupError ? `: ${authLookupError}` : "."}`;
  } else if (!insertProbe.ok) {
    message = `Trainer sign-up insert probe failed (${insertProbe.code}).`;
  } else {
    message = "Trainer sign-up health check failed.";
  }

  return NextResponse.json({
    healthy,
    databaseUrlConfigured,
    supabaseAdminConfigured,
    authLookupOk,
    authLookupError,
    insertProbeOk: insertProbe.ok,
    insertProbeCode: insertProbe.ok ? null : insertProbe.code,
    insertProbeError: insertProbe.ok ? null : insertProbe.message.slice(0, 500),
    deployCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    message,
  });
}
