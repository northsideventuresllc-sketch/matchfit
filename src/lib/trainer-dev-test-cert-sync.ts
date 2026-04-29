import { prisma } from "@/lib/prisma";
import { maybeActivateTrainerDashboard } from "@/lib/trainer-onboarding-dashboard";

function parseTestTrainerUsernameList(): string[] {
  const raw = process.env.MATCH_FIT_TEST_TRAINER_USERNAMES?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Development-only: trainers listed in MATCH_FIT_TEST_TRAINER_USERNAMES, or the account
 * resolved by MATCH_FIT_DEV_TRAINER_IDENTIFIER, get both tracks plus APPROVED CPT and
 * nutrition credentials so local QA can publish both service types without manual review.
 */
export function shouldSyncDevelopmentTestTrainerCertifications(trainer: {
  username: string;
  email: string;
  phone: string;
}): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  const usernames = parseTestTrainerUsernameList();
  const u = trainer.username.toLowerCase();
  if (usernames.includes(u)) return true;
  const ident = process.env.MATCH_FIT_DEV_TRAINER_IDENTIFIER?.trim().toLowerCase();
  if (!ident) return false;
  const phone = trainer.phone.trim().toLowerCase();
  return ident === u || ident === trainer.email.toLowerCase() || ident === phone;
}

export async function syncDevelopmentTestTrainerCertificationsForTrainer(trainer: {
  id: string;
  username: string;
  email: string;
  phone: string;
}): Promise<boolean> {
  if (process.env.NODE_ENV !== "development") return false;
  if (!shouldSyncDevelopmentTestTrainerCertifications(trainer)) return false;

  const trainerId = trainer.id;
  const before = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      onboardingTrackCpt: true,
      onboardingTrackNutrition: true,
      certificationReviewStatus: true,
      nutritionistCertificationReviewStatus: true,
    },
  });
  if (
    before?.onboardingTrackCpt &&
    before.onboardingTrackNutrition &&
    before.certificationReviewStatus === "APPROVED" &&
    before.nutritionistCertificationReviewStatus === "APPROVED"
  ) {
    return false;
  }

  await prisma.trainerProfile.update({
    where: { trainerId },
    data: {
      onboardingTrackCpt: true,
      onboardingTrackNutrition: true,
      certificationReviewStatus: "APPROVED",
      nutritionistCertificationReviewStatus: "APPROVED",
    },
  });
  await maybeActivateTrainerDashboard(trainerId);
  return true;
}
