import { isSupabaseAdminConfigured } from "@/lib/supabase/admin-client";
import { findSupabaseAuthUserByEmail } from "@/lib/supabase/find-auth-user-by-email";
import { countTrainerRegisterProfileColumns, isTrainerTermsAcceptedAtNullable, TRAINER_REGISTER_PROFILE_COLUMNS_REQUIRED } from "@/lib/ensure-trainer-register-schema";
import { countTrainerSignupTermsColumns } from "@/lib/ensure-trainer-signup-terms-schema";
import { probeTrainerRegisterInsert } from "@/lib/probe-trainer-register-insert";
import { probeTrainerSignupTermsUpdate } from "@/lib/probe-trainer-signup-terms-update";
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
  const termsProbe = await probeTrainerSignupTermsUpdate();
  const trainerProfileColumnsFound = await countTrainerRegisterProfileColumns();
  const trainerTermsColumnsFound = await countTrainerSignupTermsColumns();
  const termsAcceptedAtNullable = await isTrainerTermsAcceptedAtNullable();
  const healthy =
    databaseUrlConfigured &&
    supabaseAdminConfigured &&
    authLookupOk &&
    insertProbe.ok &&
    termsProbe.ok &&
    trainerProfileColumnsFound >= TRAINER_REGISTER_PROFILE_COLUMNS_REQUIRED &&
    trainerTermsColumnsFound >= 2 &&
    termsAcceptedAtNullable === true;

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
  } else if (!termsProbe.ok) {
    message = `Trainer agreement save probe failed (${termsProbe.code}).`;
  } else if (trainerProfileColumnsFound < TRAINER_REGISTER_PROFILE_COLUMNS_REQUIRED || trainerTermsColumnsFound < 2 || termsAcceptedAtNullable !== true) {
    message = `Trainer signup schema is out of date (profileColumns=${trainerProfileColumnsFound}/${TRAINER_REGISTER_PROFILE_COLUMNS_REQUIRED}, termsAcceptedAtNullable=${String(termsAcceptedAtNullable)}). The next sign-up attempt should auto-repair.`;
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
    trainerProfileColumnsFound,
    trainerProfileColumnsRequired: TRAINER_REGISTER_PROFILE_COLUMNS_REQUIRED,
    trainerTermsColumnsFound,
    trainerTermsColumnsRequired: 2,
    termsProbeOk: termsProbe.ok,
    termsProbeCode: termsProbe.ok ? null : termsProbe.code,
    termsProbeError: termsProbe.ok ? null : termsProbe.message.slice(0, 500),
    termsAcceptedAtNullable,
    deployCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    message,
  });
}
