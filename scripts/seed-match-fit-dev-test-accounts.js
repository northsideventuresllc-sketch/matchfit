/**
 * Upserts Match Fit owner dev/test accounts (client, trainer, administrator).
 *
 *   MATCH_FIT_DEV_TEST_ACCOUNTS_PASSWORD='…' node --env-file=.env scripts/seed-match-fit-dev-test-accounts.js
 *
 * Also set in .env (see .env.example):
 *   MATCH_FIT_DEV_CLIENT_IDENTIFIER, MATCH_FIT_DEV_TRAINER_IDENTIFIER,
 *   MATCH_FIT_TEST_TRAINER_EMAILS (trainer email for ongoing compliance sync)
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const CLIENT_EMAIL = "jonnybooth22@gmail.com";
const TRAINER_EMAIL = "jb@northsideventuresgroup.com";
const ADMIN_EMAIL = "jb@match-fit.net";
const ADMIN_CODE = "jobo0602";

const DEFAULT_CLIENT_USERNAME = "jbfitness6299";
const DEFAULT_TRAINER_USERNAME = "coachjonny22";

const CPT = "/dev/fake-cpt-certification.txt";
const NUT = "/dev/fake-nutrition-certification.txt";

const CLIENT_MATCH_PREFS = JSON.stringify({
  goals: "Strength and consistency",
  serviceTypes: ["personal_training", "nutrition"],
  deliveryModes: ["in_person", "virtual"],
  fitnessNiches: "strength, general fitness",
  allowRelaxedSearchDefault: true,
});

async function main() {
  const password = process.env.MATCH_FIT_DEV_TEST_ACCOUNTS_PASSWORD?.trim();
  if (!password || password.length < 8) {
    console.error("Set MATCH_FIT_DEV_TEST_ACCOUNTS_PASSWORD (8+ characters) before running this script.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();
  const prisma = new PrismaClient();

  try {
    const existingClient = await prisma.client.findUnique({ where: { email: CLIENT_EMAIL } });
    if (existingClient) {
      await prisma.client.update({
        where: { id: existingClient.id },
        data: {
          passwordHash,
          twoFactorEnabled: false,
          twoFactorMethod: "NONE",
          stripeSubscriptionActive: true,
          stripeLastSubscriptionInvoicePaidAt: now,
          matchPreferencesJson: CLIENT_MATCH_PREFS,
          matchPreferencesCompletedAt: existingClient.matchPreferencesCompletedAt ?? now,
        },
      });
      console.log(`Updated client: ${CLIENT_EMAIL} (${existingClient.username})`);
    } else {
      await prisma.client.create({
        data: {
          firstName: "Jonny",
          lastName: "Booth",
          preferredName: "Jonny",
          username: DEFAULT_CLIENT_USERNAME,
          phone: "+12025550199",
          email: CLIENT_EMAIL,
          passwordHash,
          zipCode: "30301",
          dateOfBirth: "1990-06-02",
          termsAcceptedAt: now,
          privacyPolicyAcceptedAt: now,
          twoFactorEnabled: false,
          twoFactorMethod: "NONE",
          stripeSubscriptionActive: true,
          stripeLastSubscriptionInvoicePaidAt: now,
          matchPreferencesJson: CLIENT_MATCH_PREFS,
          matchPreferencesCompletedAt: now,
        },
      });
      console.log(`Created client: ${CLIENT_EMAIL} (${DEFAULT_CLIENT_USERNAME})`);
    }

    const trainerProfileData = {
      hasSignedTOS: true,
      hasUploadedW9: true,
      hasPaidBackgroundFee: true,
      hasPaidRegistrationFee: true,
      backgroundCheckStatus: "APPROVED",
      backgroundCheckReviewStatus: "APPROVED",
      backgroundCheckClearedAt: now,
      onboardingTrackCpt: true,
      onboardingTrackNutrition: true,
      onboardingTrackSpecialist: false,
      specialistProfessionalRole: null,
      specialistCertificationUrl: null,
      specialistCertificationReviewStatus: "NOT_STARTED",
      certificationReviewStatus: "APPROVED",
      nutritionistCertificationReviewStatus: "APPROVED",
      certificationUrl: CPT,
      nutritionistCertificationUrl: NUT,
      dashboardActivatedAt: now,
      premiumStudioEnabledAt: now,
      matchQuestionnaireStatus: "completed",
      matchQuestionnaireCompletedAt: now,
      matchQuestionnaireAnswers: JSON.stringify({ offersInPerson: true, inPersonZip: "30301" }),
      aiMatchProfileText:
        "Match Fit owner test trainer — CPT and nutrition paths approved for full service template QA.",
    };

    const existingTrainer = await prisma.trainer.findUnique({ where: { email: TRAINER_EMAIL } });
    if (existingTrainer) {
      await prisma.trainer.update({
        where: { id: existingTrainer.id },
        data: {
          passwordHash,
          twoFactorEnabled: false,
          twoFactorMethod: "NONE",
        },
      });
      await prisma.trainerProfile.upsert({
        where: { trainerId: existingTrainer.id },
        create: { trainerId: existingTrainer.id, ...trainerProfileData },
        update: trainerProfileData,
      });
      console.log(`Updated trainer: ${TRAINER_EMAIL} (${existingTrainer.username})`);
    } else {
      const t = await prisma.trainer.create({
        data: {
          firstName: "Jonny",
          lastName: "Booth",
          preferredName: "Jonny",
          username: DEFAULT_TRAINER_USERNAME,
          phone: "+12025550299",
          email: TRAINER_EMAIL,
          passwordHash,
          fitnessNiches: "strength, nutrition, general fitness",
          yearsCoaching: "10",
          termsAcceptedAt: now,
          privacyPolicyAcceptedAt: now,
          twoFactorEnabled: false,
          twoFactorMethod: "NONE",
        },
      });
      await prisma.trainerProfile.create({
        data: { trainerId: t.id, ...trainerProfileData },
      });
      console.log(`Created trainer: ${TRAINER_EMAIL} (${DEFAULT_TRAINER_USERNAME})`);
    }

    await prisma.administrator.upsert({
      where: { adminCode: ADMIN_CODE },
      create: {
        adminCode: ADMIN_CODE,
        email: ADMIN_EMAIL,
        passwordHash,
        firstName: "Jonny",
        lastName: "Booth",
        dateOfBirth: "1990-06-02",
      },
      update: {
        email: ADMIN_EMAIL,
        passwordHash,
        firstName: "Jonny",
        lastName: "Booth",
        dateOfBirth: "1990-06-02",
      },
    });
    console.log(`Administrator upserted: ${ADMIN_CODE} (${ADMIN_EMAIL})`);

    console.log("\nAdd to .env for dev shortcuts and trainer compliance sync:");
    console.log(`MATCH_FIT_DEV_CLIENT_IDENTIFIER=${CLIENT_EMAIL}`);
    console.log(`MATCH_FIT_DEV_TRAINER_IDENTIFIER=${TRAINER_EMAIL}`);
    console.log(`MATCH_FIT_TEST_TRAINER_EMAILS=${TRAINER_EMAIL}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
