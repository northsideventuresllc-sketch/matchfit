import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { BetaCapExceededError } from "@/lib/beta-cap-enforcement";
import { evaluateBetaTrainerRegistrationGate } from "@/lib/beta-trainer-register-gate";
import { markTrainerWaitlistRegistered } from "@/lib/beta-waitlist-service";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin-client";
import { findSupabaseAuthUserByEmail } from "@/lib/supabase/find-auth-user-by-email";
import { isMissingTrainerRegisterSchemaError } from "@/lib/ensure-trainer-register-schema";
import { createTrainerRecord } from "@/lib/trainer-register-service";
import { isTrainerEmailTaken, isTrainerUsernameTaken } from "@/lib/trainer-queries";
import { resolveTrainerSignupNextPath } from "@/lib/trainer-signup-next-path";
import { sendTrainerWelcomeEmail } from "@/lib/trainer-welcome-email";
import type { TrainerSignupParsed } from "@/lib/trainer-register-service";

export type CompleteTrainerSupabaseSignupResult =
  | { ok: true; trainerId: string; next: string; emailConfirmed: boolean }
  | { ok: false; error: string; code?: string; status: number };

function mapCreateTrainerError(e: unknown): CompleteTrainerSupabaseSignupResult | null {
  if (e instanceof BetaCapExceededError) {
    return { ok: false, error: e.message, code: e.code, status: 403 };
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") {
      const target = Array.isArray(e.meta?.target) ? e.meta.target.join(",") : String(e.meta?.target ?? "");
      if (target.includes("email")) {
        return { ok: false, error: "That email is already registered.", code: "EMAIL_TAKEN", status: 409 };
      }
      if (target.includes("username")) {
        return { ok: false, error: "That username is already taken.", code: "USERNAME_TAKEN", status: 409 };
      }
      return { ok: false, error: "That account detail is already in use.", code: "UNIQUE_VIOLATION", status: 409 };
    }
    if (e.code === "P2021" || e.code === "P2022") {
      return {
        ok: false,
        error:
          "Sign-up is temporarily unavailable while we finish a database update. Please try again in a few minutes or contact support@match-fit.net if this persists.",
        code: "SCHEMA_OUT_OF_DATE",
        status: 503,
      };
    }
    if (e.code === "P2011" || e.code === "P2012") {
      return {
        ok: false,
        error:
          "Sign-up is temporarily unavailable while we finish a database update. Please try again in a few minutes or contact support@match-fit.net if this persists.",
        code: "SCHEMA_OUT_OF_DATE",
        status: 503,
      };
    }
  }
  return null;
}

/**
 * Validates Supabase credentials, creates the Match Fit trainer row, and returns the
 * post-signup redirect path plus whether the email has actually been confirmed.
 *
 * Does not call Supabase Auth sign-in APIs (those require a browser captcha token when
 * Attack Protection is enabled). Match Fit verifies Turnstile on the API route before
 * calling this helper.
 *
 * `requireEmailConfirmed` defaults to true, which keeps the original behaviour for the
 * legacy "Finish sign-up with password" route. The Fitness Pro agreement path passes
 * false: since 2026-08-04 sign-up goes straight to the agreement and the account is
 * created before the address is proven, with confirmation moved onto the dashboard.
 * Callers that pass false MUST persist `emailConfirmed` so the dashboard can prompt.
 */
export async function completeTrainerSupabaseSignup(
  body: TrainerSignupParsed,
  options?: { createAccount?: boolean; requireEmailConfirmed?: boolean },
): Promise<CompleteTrainerSupabaseSignupResult> {
  const createAccount = options?.createAccount === true;
  const requireEmailConfirmed = options?.requireEmailConfirmed !== false;
  try {
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

    const authUser = await findSupabaseAuthUserByEmail(email);
    if (!authUser) {
      return {
        ok: false,
        error: "No sign-up record found for this email. Submit the sign-up form first.",
        code: "SUPABASE_USER_MISSING",
        status: 404,
      };
    }

    const emailConfirmed = authUser.email_confirmed_at != null;
    if (!emailConfirmed && requireEmailConfirmed) {
      return {
        ok: false,
        error: "Confirm your email first, then tap Finish sign-up with password.",
        code: "EMAIL_NOT_CONFIRMED",
        status: 403,
      };
    }

    const admin = createSupabaseAdminClient();
    const { error: passwordSyncError } = await admin.auth.admin.updateUserById(authUser.id, {
      password: body.password,
      user_metadata: {
        match_fit_role: "trainer",
        pending_match_fit_profile: false,
        // Never claim an address is verified when it is not — this metadata is read back by
        // /auth/callback and by anything else trusting Supabase. It tracks the real flag.
        email_verified: emailConfirmed,
      },
    });
    if (passwordSyncError) {
      console.error("[completeTrainerSupabaseSignup] updateUserById", passwordSyncError);
      return {
        ok: false,
        error: passwordSyncError.message?.trim() || "Could not sync your password.",
        code: "SUPABASE_PASSWORD_SYNC_FAILED",
        status: 400,
      };
    }

    if (!createAccount) {
      return { ok: true, trainerId: "", next: "/trainer/signup/terms", emailConfirmed };
    }

    const { id: trainerId, email: createdEmail } = await createTrainerRecord(body, {
      betaInviteEntryId: gate.betaInviteEntryId,
    });

    if (emailConfirmed) {
      // Never let recording the verification timestamp fail the account creation itself.
      try {
        await prisma.trainer.update({
          where: { id: trainerId },
          data: { emailVerifiedAt: new Date() },
        });
      } catch (err) {
        console.error("[completeTrainerSupabaseSignup] emailVerifiedAt stamp failed:", err);
      }
    }

    if (gate.betaInviteEntryId) {
      await markTrainerWaitlistRegistered(gate.betaInviteEntryId, trainerId);
    }

    const profile = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: {
        hasSignedTOS: true,
        registrationFeeHoldStatus: true,
        hasPaidRegistrationFee: true,
        limitedDashboardUnlockedAt: true,
        onboardingFeePaymentDeadlineAt: true,
        onboardingFeePaymentExpiredAt: true,
      },
    });

    void sendTrainerWelcomeEmail({
      to: createdEmail,
      firstName: body.firstName,
      trainerId,
    }).catch((err) => console.error("[completeTrainerSupabaseSignup] welcome email failed:", err));

    return { ok: true, trainerId, next: resolveTrainerSignupNextPath(profile), emailConfirmed };
  } catch (e) {
    const mapped = mapCreateTrainerError(e);
    if (mapped) return mapped;
    if (isMissingTrainerRegisterSchemaError(e)) {
      return {
        ok: false,
        error:
          "Sign-up is temporarily unavailable while we finish a database update. Please try again in a few minutes or contact support@match-fit.net if this persists.",
        code: "SCHEMA_OUT_OF_DATE",
        status: 503,
      };
    }
    console.error("[completeTrainerSupabaseSignup]", e);
    return {
      ok: false,
      error: "Registration failed. Please try again.",
      code: "UNEXPECTED",
      status: 500,
    };
  }
}

export { BetaCapExceededError };
