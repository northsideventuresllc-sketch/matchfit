import "server-only";
import { createClient } from "@supabase/supabase-js";
import { BetaCapExceededError } from "@/lib/beta-cap-enforcement";
import { evaluateBetaTrainerRegistrationGate } from "@/lib/beta-trainer-register-gate";
import { markTrainerWaitlistRegistered } from "@/lib/beta-waitlist-service";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin-client";
import { createTrainerRecord } from "@/lib/trainer-register-service";
import { isTrainerEmailTaken, isTrainerUsernameTaken } from "@/lib/trainer-queries";
import { resolveTrainerSignupNextPath } from "@/lib/trainer-signup-next-path";
import { sendTrainerWelcomeEmail } from "@/lib/trainer-welcome-email";
import type { TrainerSignupParsed } from "@/lib/trainer-register-service";

export type CompleteTrainerSupabaseSignupResult =
  | { ok: true; trainerId: string; next: string }
  | { ok: false; error: string; code?: string; status: number };

function isEmailNotConfirmedError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("email not confirmed") || m.includes("email_not_confirmed");
}

type SupabaseAuthUserRow = {
  id: string;
  email_confirmed_at: Date | null;
};

async function findSupabaseAuthUser(email: string): Promise<SupabaseAuthUserRow | null> {
  const rows = await prisma.$queryRaw<SupabaseAuthUserRow[]>`
    SELECT id, email_confirmed_at
    FROM auth.users
    WHERE lower(email) = lower(${email})
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function syncSupabasePassword(
  userId: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) {
    console.error("[completeTrainerSupabaseSignup] syncSupabasePassword", error);
    return { ok: false, error: error.message?.trim() || "Could not sync your password." };
  }
  return { ok: true };
}

async function signInSupabaseWithPassword(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const client = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const attempt = await client.auth.signInWithPassword({ email, password });
  if (!attempt.error) return { ok: true };

  if (isEmailNotConfirmedError(attempt.error.message)) {
    return {
      ok: false,
      error: "Confirm your email first, then tap Finish sign-up with password.",
    };
  }

  return { ok: false, error: attempt.error.message || "Could not verify your password." };
}

/**
 * Validates Supabase credentials, ensures email is confirmed, creates the Match Fit
 * trainer row, and returns the post-signup redirect path.
 */
export async function completeTrainerSupabaseSignup(
  body: TrainerSignupParsed,
): Promise<CompleteTrainerSupabaseSignupResult> {
  const email = body.email.trim().toLowerCase();
  const username = body.username.trim();

  const gate = await evaluateBetaTrainerRegistrationGate({
    serviceZipCode: body.serviceZipCode ?? "",
    email,
    username,
    betaInviteToken: body.betaInviteToken,
  });
  if (!gate.ok) {
    return { ok: false, error: gate.error, code: gate.code, status: gate.status };
  }

  if (await isTrainerUsernameTaken(username)) {
    return { ok: false, error: "That username is already taken.", code: "USERNAME_TAKEN", status: 409 };
  }
  if (await isTrainerEmailTaken(email)) {
    return { ok: false, error: "That email is already registered.", code: "EMAIL_TAKEN", status: 409 };
  }

  if (!isSupabaseAdminConfigured()) {
    return {
      ok: false,
      error: "Trainer sign-up is not fully configured. Contact support@match-fit.net.",
      code: "SUPABASE_ADMIN_NOT_CONFIGURED",
      status: 503,
    };
  }

  const authUser = await findSupabaseAuthUser(email);
  if (!authUser) {
    return {
      ok: false,
      error: "No sign-up record found for this email. Submit the sign-up form first.",
      code: "SUPABASE_USER_MISSING",
      status: 404,
    };
  }

  const emailConfirmed = authUser.email_confirmed_at != null;
  if (!emailConfirmed) {
    return {
      ok: false,
      error: "Confirm your email first, then tap Finish sign-up with password.",
      code: "EMAIL_NOT_CONFIRMED",
      status: 403,
    };
  }

  const passwordSync = await syncSupabasePassword(authUser.id, body.password);
  if (!passwordSync.ok) {
    return {
      ok: false,
      error: passwordSync.error,
      code: "SUPABASE_PASSWORD_SYNC_FAILED",
      status: 400,
    };
  }

  const signIn = await signInSupabaseWithPassword(email, body.password);
  if (!signIn.ok) {
    return {
      ok: false,
      error: signIn.error,
      code: "SUPABASE_AUTH_FAILED",
      status: 401,
    };
  }

  const { id: trainerId, email: createdEmail } = await createTrainerRecord(body, {
    betaInviteEntryId: gate.betaInviteEntryId,
  });

  if (gate.betaInviteEntryId) {
    await markTrainerWaitlistRegistered(gate.betaInviteEntryId, trainerId);
  }

  const admin = createSupabaseAdminClient();
  await admin.auth.admin.updateUserById(authUser.id, {
    user_metadata: {
      match_fit_role: "trainer",
      pending_match_fit_profile: false,
      email_verified: true,
    },
  });

  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      hasSignedTOS: true,
      registrationFeeHoldStatus: true,
      hasPaidRegistrationFee: true,
      limitedDashboardUnlockedAt: true,
    },
  });

  void sendTrainerWelcomeEmail({
    to: createdEmail,
    firstName: body.firstName,
    trainerId,
  }).catch((err) => console.error("[completeTrainerSupabaseSignup] welcome email failed:", err));

  return { ok: true, trainerId, next: resolveTrainerSignupNextPath(profile) };
}

export { BetaCapExceededError };
