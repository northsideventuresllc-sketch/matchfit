import "server-only";

import { completeTrainerSupabaseSignup } from "@/lib/complete-trainer-supabase-signup";
import { createTrainerRecord } from "@/lib/trainer-register-service";
import { markTrainerWaitlistRegistered } from "@/lib/beta-waitlist-service";
import { prisma } from "@/lib/prisma";
import { sendTrainerWelcomeEmail } from "@/lib/trainer-welcome-email";
import { resolveTrainerSignupNextPath } from "@/lib/trainer-signup-next-path";
import { markTrainerPendingAfterTermsAcceptance } from "@/lib/trainer-pending-onboarding";
import { TRAINER_ONBOARDING_FEE_DEADLINE_MS } from "@/lib/trainer-onboarding-fee-deadline";
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
  const prep = await completeTrainerSupabaseSignup(body, { createAccount: false });
  if (!prep.ok) {
    return prep;
  }

  const now = new Date();

  const { id: trainerId, email } = await createTrainerRecord(body, {
    betaInviteEntryId: options?.betaInviteEntryId ?? null,
  });

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

  return {
    ok: true,
    trainerId,
    email,
    firstName: body.firstName,
    next: resolveTrainerSignupNextPath(profile),
  };
}

export { TRAINER_ONBOARDING_FEE_DEADLINE_MS };
