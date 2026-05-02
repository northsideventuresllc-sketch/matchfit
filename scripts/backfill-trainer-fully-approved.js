/**
 * One-off / ops: set a trainer's onboarding tracks + approved CPT + nutrition credentials
 * so dashboard service publishing works (e.g. legacy accounts before track flags existed).
 *
 * Usage (from repo root, DATABASE_URL set):
 *   node scripts/backfill-trainer-fully-approved.js coachshitthead22
 */
const { PrismaClient } = require("@prisma/client");

const CPT = "/dev/fake-cpt-certification.txt";
const NUT = "/dev/fake-nutrition-certification.txt";

async function main() {
  const username = (process.argv[2] || "").trim();
  if (!username) {
    console.error("Usage: node scripts/backfill-trainer-fully-approved.js <username>");
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    const trainer = await prisma.trainer.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: { id: true, username: true },
    });
    if (!trainer) {
      console.error(`No trainer found for username: ${username}`);
      process.exit(2);
    }
    await prisma.trainerProfile.update({
      where: { trainerId: trainer.id },
      data: {
        onboardingTrackCpt: true,
        onboardingTrackNutrition: true,
        onboardingTrackSpecialist: false,
        specialistProfessionalRole: null,
        certificationReviewStatus: "APPROVED",
        nutritionistCertificationReviewStatus: "APPROVED",
        specialistCertificationReviewStatus: "NOT_STARTED",
        certificationUrl: CPT,
        nutritionistCertificationUrl: NUT,
      },
    });
    console.log(`Updated trainer ${trainer.username} (${trainer.id}): CPT + nutrition tracks, APPROVED, placeholder cert URLs.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
