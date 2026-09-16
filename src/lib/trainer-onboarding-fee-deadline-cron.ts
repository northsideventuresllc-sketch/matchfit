import { prisma } from "@/lib/prisma";
import { isTrainerOnboardingFeePaymentOverdue } from "@/lib/trainer-onboarding-fee-deadline";

export async function processTrainerOnboardingFeeDeadlineExpirations(): Promise<number> {
  const rows = await prisma.trainerProfile.findMany({
    where: {
      hasSignedTOS: true,
      onboardingFeePaymentDeadlineAt: { not: null },
      onboardingFeePaymentExpiredAt: null,
      registrationFeeHoldStatus: { in: ["NOT_STARTED", "CANCELED"] },
      hasPaidRegistrationFee: false,
    },
    select: {
      trainerId: true,
      onboardingFeePaymentDeadlineAt: true,
      registrationFeeHoldStatus: true,
      hasPaidRegistrationFee: true,
      // Founding BG-covered/discounted trainers owe nothing (see `registrationFeeWaived` in
      // `trainer-onboarding-fee-deadline.ts`) and never naturally reach a HELD/CAPTURED/DEFERRED
      // hold, so without this they would always look "unpaid" and always go overdue at the
      // 7-day mark regardless of the waiver. Added 2026-09-15 alongside the `deidentifiedAt` fix
      // above after confirming every currently-affected real trainer had `registrationFeeWaived:
      // true`.
      registrationFeeWaived: true,
    },
  });

  let expired = 0;
  const now = new Date();
  for (const row of rows) {
    if (!isTrainerOnboardingFeePaymentOverdue(row, now)) continue;
    // Deliberately does NOT touch `Trainer.deidentifiedAt` here (fixed 2026-09-15, see
    // NI-Brain Learning [STALE-PROMPT] this session — confirmed via `deidentifiedAt` ===
    // `onboardingFeePaymentExpiredAt` on real, non-synthetic trainer rows with intact PII).
    // `deidentifiedAt` means "PII irreversibly scrubbed" (see `deidentifyTrainerAccountWithDb`
    // in `account-deidentify-core.ts`, which tombstones name/email/username in the same
    // transaction). A missed onboarding-fee deadline is a real, live account that has not been
    // deleted — it needs its own signal, `onboardingFeePaymentExpiredAt`, which already fully
    // drives the "go pay now" routing in `trainer-signup-next-path.ts`. Setting `deidentifiedAt`
    // here silently dropped these still-active, non-deleted trainers out of every
    // `deidentifiedAt: null`-gated query in the app, including the public founding-trainer
    // counter (`launchTrainerAccountWhere` in `launch-account-counts.ts`) and the admin portal
    // (which then mislabeled them "Removed (deidentified)" in `trainer-membership-status.ts`
    // despite their account/PII being fully intact).
    await prisma.trainerProfile.update({
      where: { trainerId: row.trainerId },
      data: { onboardingFeePaymentExpiredAt: now, updatedAt: now },
    });
    expired += 1;
  }
  return expired;
}
