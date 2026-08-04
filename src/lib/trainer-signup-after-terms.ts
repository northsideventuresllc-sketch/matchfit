import "server-only";

import { completeTrainerSupabaseSignup } from "@/lib/complete-trainer-supabase-signup";
import { createTrainerRecord } from "@/lib/trainer-register-service";
import { markTrainerWaitlistRegistered } from "@/lib/beta-waitlist-service";
import { prisma } from "@/lib/prisma";
import { sendTrainerWelcomeEmail } from "@/lib/trainer-welcome-email";
import { resolveTrainerSignupNextPath } from "@/lib/trainer-signup-next-path";
import { markTrainerPendingAfterTermsAcceptance } from "@/lib/trainer-pending-onboarding";
import { TRAINER_ONBOARDING_FEE_DEADLINE_MS } from "@/lib/trainer-onboarding-fee-deadline";
import { trackServerConversion } from "@/lib/server-conversion-tracking";
import type { TrainerSignupParsed } from "@/lib/trainer-register-service";

export type CreateTrainerAfterTermsResult =
  | { ok: true; trainerId: string; next: string; email: string; firstName: string }
  | { ok: false; error: string; code?: string; status: number };

/**
 * Creates the Match Fit trainer row after TOS acceptance, unlocks limited dashboard,
 * and starts the 7-day onboarding fee + compliance window.
 */
export async function createTrainerAccountAfterTermsAcceptance(
  body: TrainerSignupParsed,
  options?: { betaInviteEntryId?: string | null },
): Promise<CreateTrainerAfterTermsResult> {
  // Sign-up goes straight here from the form, so the email is normally still unconfirmed at
  // this point (JB, 2026-08-04). We create the account anyway and carry the real state onto
  // the row, which is what the dashboard prompt reads.
  const prep = await completeTrainerSupabaseSignup(body, {
    createAccount: false,
    requireEmailConfirmed: false,
  });
  if (!prep.ok) {
    return prep;
  }

  const now = new Date();

  const { id: trainerId, email } = await createTrainerRecord(body, {
    betaInviteEntryId: options?.betaInviteEntryId ?? null,
  });

  if (prep.emailConfirmed) {
    // Never let recording the verification timestamp fail the account creation itself.
    try {
      await prisma.trainer.update({ where: { id: trainerId }, data: { emailVerifiedAt: now } });
    } catch (err) {
      console.error("[createTrainerAccountAfterTermsAcceptance] emailVerifiedAt stamp failed:", err);
    }
  }

  await prisma.$transaction(async (tx) => {
    await markTrainerPendingAfterTermsAcceptance(trainerId, now, tx);
  });

  await prisma.trainerDraft
    .deleteMany({ where: { email: email.toLowerCase() } })
    .catch((err) => console.error("[createTrainerAccountAfterTermsAcceptance] draft cleanup failed:", err));

  if (options?.betaInviteEntryId) {
    await markTrainerWaitlistRegistered(options.betaInviteEntryId, trainerId);
  }

  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      hasSignedTOS: true,
      accountTier: true,
      docsSubmitted: true,
      docsApproved: true,
      registrationFeeHoldStatus: true,
      hasPaidRegistrationFee: true,
      limitedDashboardUnlockedAt: true,
      onboardingFeePaymentDeadlineAt: true,
      onboardingFeePaymentExpiredAt: true,
    },
  });

  void sendTrainerWelcomeEmail({
    to: email,
    firstName: body.firstName,
    trainerId,
  }).catch((err) => console.error("[createTrainerAccountAfterTermsAcceptance] welcome email failed:", err));

  void trackServerConversion({ event: "trainer_tos_accepted", userId: trainerId, email }).catch((err) =>
    console.error("[createTrainerAccountAfterTermsAcceptance] tracking failed:", err),
  );

  // Marketing skeleton — trainer signup signal (non-blocking).
  void import("@/lib/marketing/skeleton")
    .then(({ recordMatchFitMarketingSignal }) =>
      recordMatchFitMarketingSignal({ signalType: "signup", detail: { event: "trainer_created" } }),
    )
    .catch((err) => console.error("[createTrainerAccountAfterTermsAcceptance] skeleton signal failed:", err));

  return {
    ok: true,
    trainerId,
    email,
    firstName: body.firstName,
    next: resolveTrainerSignupNextPath(profile),
  };
}

export { TRAINER_ONBOARDING_FEE_DEADLINE_MS };
