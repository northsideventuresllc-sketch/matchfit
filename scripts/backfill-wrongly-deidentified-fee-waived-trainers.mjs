/**
 * One-off data correction (2026-09-15): un-deidentify real trainers who were wrongly marked
 * `deidentifiedAt` by the onboarding-fee-deadline cron / compliance-window-expiry sync, instead
 * of the real account-deletion PII-scrub path (`deidentifyTrainerAccountWithDb` in
 * `account-deidentify-core.ts`).
 *
 * Root cause (see `src/lib/trainer-onboarding-fee-deadline-cron.ts` and
 * `src/lib/trainer-compliance-window-sync.ts` for the code fix): both crons stamped
 * `Trainer.deidentifiedAt` as a side effect of the onboarding-fee deadline / compliance window
 * expiring, without doing any actual PII scrub. `deidentifiedAt: null` gates the public
 * founding-trainer counter (`launchTrainerAccountWhere` in `launch-account-counts.ts`) and most
 * other trainer-facing queries in the app, so these real, still-live, non-deleted trainers
 * silently vanished from the public "X of 30 coaches signed up" counter and were mislabeled
 * "Removed (deidentified)" in the admin portal.
 *
 * A second, compounding bug (also fixed) meant the fee-deadline cron never recognized a waived
 * registration fee (`registrationFeeWaived: true`, e.g. the founding BG-covered cohort) as
 * "paid" — those trainers owe nothing and never naturally reach a Stripe HELD/CAPTURED/DEFERRED
 * hold, so they always looked permanently unpaid and always got expired at the 7-day mark.
 * Every real trainer this script finds matches that exact fingerprint.
 *
 * Detection (deliberately conservative, no broad `deidentifiedAt IS NOT NULL` scan): a row only
 * qualifies if `Trainer.deidentifiedAt` exactly equals `TrainerProfile.onboardingFeePaymentExpiredAt`
 * OR `TrainerProfile.complianceWindowExpiredAt` (the two buggy call sites stamped both fields in
 * the same instant), the account is not internal QA/synthetic, and the email/username do not
 * match the real tombstone pattern used by the actual PII-scrub path — so a genuinely deleted
 * account can never be matched and "repaired" by mistake.
 *
 * Usage (dry run by default, prints what it would change):
 *   node --env-file=.env scripts/backfill-wrongly-deidentified-fee-waived-trainers.mjs
 *   node --env-file=.env scripts/backfill-wrongly-deidentified-fee-waived-trainers.mjs --apply
 */

async function main() {
  const apply = process.argv.includes("--apply");
  const { createPrismaClient } = await import("./create-prisma-client.mjs");
  const prisma = createPrismaClient();

  try {
    const candidates = await prisma.trainer.findMany({
      where: {
        deidentifiedAt: { not: null },
        internalQaSyntheticPersona: false,
        email: { not: { endsWith: "@account-removed.invalid" } },
        NOT: { username: { startsWith: "delt_" } },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        username: true,
        createdAt: true,
        deidentifiedAt: true,
        profile: {
          select: {
            onboardingFeePaymentExpiredAt: true,
            complianceWindowExpiredAt: true,
            registrationFeeWaived: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const matches = candidates.filter((t) => {
      const p = t.profile;
      if (!p) return false;
      const deidentifiedMs = t.deidentifiedAt?.getTime();
      const viaFeeDeadline = p.onboardingFeePaymentExpiredAt && p.onboardingFeePaymentExpiredAt.getTime() === deidentifiedMs;
      const viaComplianceWindow = p.complianceWindowExpiredAt && p.complianceWindowExpiredAt.getTime() === deidentifiedMs;
      return Boolean(viaFeeDeadline || viaComplianceWindow);
    });

    if (matches.length === 0) {
      console.log("No wrongly-deidentified trainers found. Nothing to do.");
      return;
    }

    console.log(`Found ${matches.length} real trainer(s) wrongly marked deidentified:\n`);
    for (const t of matches) {
      const via = t.profile.onboardingFeePaymentExpiredAt?.getTime() === t.deidentifiedAt?.getTime()
        ? "onboardingFeePaymentExpiredAt"
        : "complianceWindowExpiredAt";
      console.log(
        `  ${t.id}  ${t.firstName} ${t.lastName}  <${t.email}>  @${t.username}  ` +
          `signed up ${t.createdAt.toISOString()}  wrongly deidentified via ${via} at ${t.deidentifiedAt.toISOString()}` +
          `  (registrationFeeWaived=${t.profile.registrationFeeWaived})`,
      );
    }

    if (!apply) {
      console.log("\nDry run only — re-run with --apply to clear deidentifiedAt + the wrongly-set expiry field(s).");
      return;
    }

    let fixed = 0;
    for (const t of matches) {
      await prisma.$transaction([
        prisma.trainer.update({
          where: { id: t.id },
          data: { deidentifiedAt: null },
        }),
        prisma.trainerProfile.update({
          where: { trainerId: t.id },
          data: {
            ...(t.profile.onboardingFeePaymentExpiredAt ? { onboardingFeePaymentExpiredAt: null } : {}),
            ...(t.profile.complianceWindowExpiredAt ? { complianceWindowExpiredAt: null } : {}),
          },
        }),
      ]);
      fixed += 1;
      console.log(`Fixed ${t.id} (${t.firstName} ${t.lastName}).`);
    }
    console.log(`\nDone. Corrected ${fixed} trainer row(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
