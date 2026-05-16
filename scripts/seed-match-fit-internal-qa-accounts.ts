/**
 * Creates or updates the Match Fit internal QA trainer + client accounts configured via env.
 *
 * Prerequisites:
 * - `MATCH_FIT_INTERNAL_QA_ENABLED=1`
 * - `MATCH_FIT_INTERNAL_QA_CLIENT_EMAILS` / `MATCH_FIT_INTERNAL_QA_TRAINER_EMAILS` must include the seed emails
 * - Database migrated (internal QA columns)
 *
 * Example:
 *   MATCH_FIT_INTERNAL_QA_ENABLED=1 \
 *   MATCH_FIT_INTERNAL_QA_CLIENT_EMAILS="you+client@example.com" \
 *   MATCH_FIT_INTERNAL_QA_TRAINER_EMAILS="you+trainer@example.com" \
 *   MATCH_FIT_INTERNAL_QA_SEED_CLIENT_EMAIL="you+client@example.com" \
 *   MATCH_FIT_INTERNAL_QA_SEED_TRAINER_EMAIL="you+trainer@example.com" \
 *   MATCH_FIT_INTERNAL_QA_SEED_CLIENT_USERNAME="jbfitness6299" \
 *   MATCH_FIT_INTERNAL_QA_SEED_CLIENT_PASSWORD='YourPassword!' \
 *   MATCH_FIT_INTERNAL_QA_SEED_CLIENT_PHONE="+12025550199" \
 *   MATCH_FIT_INTERNAL_QA_SEED_TRAINER_USERNAME="coachjonny22" \
 *   MATCH_FIT_INTERNAL_QA_SEED_TRAINER_PASSWORD='YourPassword!' \
 *   MATCH_FIT_INTERNAL_QA_SEED_TRAINER_PHONE="+12025550299" \
 *   node --env-file=.env npx tsx scripts/seed-match-fit-internal-qa-accounts.ts
 */
import {
  ensureInternalQaSyntheticClientPool,
  ensureInternalQaSyntheticTrainerPool,
} from "../src/lib/internal-qa-simulation";
import {
  isMatchFitInternalQaClientEmail,
  isMatchFitInternalQaEnabled,
  isMatchFitInternalQaTrainerEmail,
} from "../src/lib/match-fit-internal-qa";
import { hashPassword } from "../src/lib/password";
import { prisma } from "../src/lib/prisma";

function req(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Missing required env ${name}`);
    process.exit(1);
  }
  return v;
}

void (async () => {
  if (!isMatchFitInternalQaEnabled()) {
    console.error("Set MATCH_FIT_INTERNAL_QA_ENABLED=1 before running this script.");
    process.exit(1);
  }

  const clientEmail = req("MATCH_FIT_INTERNAL_QA_SEED_CLIENT_EMAIL");
  const trainerEmail = req("MATCH_FIT_INTERNAL_QA_SEED_TRAINER_EMAIL");
  if (!isMatchFitInternalQaClientEmail(clientEmail) || !isMatchFitInternalQaTrainerEmail(trainerEmail)) {
    console.error(
      "Seed emails must be listed in MATCH_FIT_INTERNAL_QA_CLIENT_EMAILS / MATCH_FIT_INTERNAL_QA_TRAINER_EMAILS.",
    );
    process.exit(1);
  }

  const clientUsername = req("MATCH_FIT_INTERNAL_QA_SEED_CLIENT_USERNAME");
  const trainerUsername = req("MATCH_FIT_INTERNAL_QA_SEED_TRAINER_USERNAME");
  const clientPassword = req("MATCH_FIT_INTERNAL_QA_SEED_CLIENT_PASSWORD");
  const trainerPassword = req("MATCH_FIT_INTERNAL_QA_SEED_TRAINER_PASSWORD");

  const clientHash = await hashPassword(clientPassword);
  const trainerHash = await hashPassword(trainerPassword);
  const now = new Date();

  const existingClient = await prisma.client.findUnique({ where: { email: clientEmail } });
  if (existingClient) {
    await prisma.client.update({
      where: { id: existingClient.id },
      data: {
        username: clientUsername,
        passwordHash: clientHash,
        twoFactorEnabled: false,
        twoFactorMethod: "NONE",
        stripeSubscriptionActive: true,
        stripeLastSubscriptionInvoicePaidAt: now,
      },
    });
    console.log("Updated existing QA client:", clientEmail);
  } else {
    await prisma.client.create({
      data: {
        firstName: "Internal",
        lastName: "QAClient",
        preferredName: "Internal QA Client",
        username: clientUsername,
        phone: req("MATCH_FIT_INTERNAL_QA_SEED_CLIENT_PHONE"),
        email: clientEmail,
        passwordHash: clientHash,
        zipCode: "10001",
        dateOfBirth: "1990-01-01",
        termsAcceptedAt: now,
        privacyPolicyAcceptedAt: now,
        twoFactorEnabled: false,
        twoFactorMethod: "NONE",
        stripeSubscriptionActive: true,
        stripeLastSubscriptionInvoicePaidAt: now,
      },
    });
    console.log("Created QA client:", clientEmail);
  }

  const existingTrainer = await prisma.trainer.findUnique({ where: { email: trainerEmail } });
  if (existingTrainer) {
    await prisma.trainer.update({
      where: { id: existingTrainer.id },
      data: {
        username: trainerUsername,
        passwordHash: trainerHash,
        twoFactorEnabled: false,
        twoFactorMethod: "NONE",
      },
    });
    await prisma.trainerProfile.upsert({
      where: { trainerId: existingTrainer.id },
      create: {
        trainerId: existingTrainer.id,
        premiumStudioEnabledAt: now,
        hasSignedTOS: true,
        hasUploadedW9: true,
        dashboardActivatedAt: now,
        matchQuestionnaireStatus: "completed",
        aiMatchProfileText: "Internal QA trainer seed profile.",
      },
      update: {
        premiumStudioEnabledAt: now,
      },
    });
    console.log("Updated existing QA trainer:", trainerEmail);
  } else {
    const t = await prisma.trainer.create({
      data: {
        firstName: "Internal",
        lastName: "QATrainer",
        preferredName: "Internal QA Trainer",
        username: trainerUsername,
        phone: req("MATCH_FIT_INTERNAL_QA_SEED_TRAINER_PHONE"),
        email: trainerEmail,
        passwordHash: trainerHash,
        termsAcceptedAt: now,
        privacyPolicyAcceptedAt: now,
        twoFactorEnabled: false,
        twoFactorMethod: "NONE",
        fitnessNiches: "strength, general fitness",
        yearsCoaching: "5",
      },
    });
    await prisma.trainerProfile.create({
      data: {
        trainerId: t.id,
        premiumStudioEnabledAt: now,
        hasSignedTOS: true,
        hasUploadedW9: true,
        dashboardActivatedAt: now,
        matchQuestionnaireStatus: "completed",
        aiMatchProfileText: "Internal QA trainer seed profile.",
      },
    });
    console.log("Created QA trainer:", trainerEmail);
  }

  await ensureInternalQaSyntheticTrainerPool();
  await ensureInternalQaSyntheticClientPool();
  console.log("Synthetic pools ensured.");
})();
