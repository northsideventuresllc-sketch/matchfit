import { prisma } from "@/lib/prisma";
import {
  TRAINER_DEV_FAKE_CPT_CERTIFICATION_PATH,
  TRAINER_DEV_FAKE_NUTRITION_CERTIFICATION_PATH,
} from "@/lib/trainer-dev-cert-placeholders";
import { maybeActivateTrainerDashboard } from "@/lib/trainer-onboarding-dashboard";

function parseTestTrainerUsernameList(): string[] {
  const raw = process.env.MATCH_FIT_TEST_TRAINER_USERNAMES?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function parseTruthishEnv(v: string | undefined): boolean {
  const t = v?.trim().toLowerCase();
  return t === "1" || t === "true" || t === "yes";
}

function shouldDevApproveAllTrainerCerts(): boolean {
  return process.env.NODE_ENV === "development" && parseTruthishEnv(process.env.MATCH_FIT_DEV_APPROVE_ALL_TRAINER_CERTS);
}

/**
 * Development-only: trainers listed in MATCH_FIT_TEST_TRAINER_USERNAMES, the account
 * resolved by MATCH_FIT_DEV_TRAINER_IDENTIFIER, OR (when MATCH_FIT_DEV_APPROVE_ALL_TRAINER_CERTS
 * is truthy) any trainer — get both tracks plus APPROVED CPT and nutrition credentials
 * and placeholder cert URLs so local QA can use certification-gated flows without manual review.
 */
export function shouldSyncDevelopmentTestTrainerCertifications(trainer: {
  username: string;
  email: string;
  phone: string;
}): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  if (shouldDevApproveAllTrainerCerts()) return true;
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
      certificationUrl: true,
      nutritionistCertificationUrl: true,
    },
  });
  const cptUrl = before?.certificationUrl?.trim() || TRAINER_DEV_FAKE_CPT_CERTIFICATION_PATH;
  const nutUrl = before?.nutritionistCertificationUrl?.trim() || TRAINER_DEV_FAKE_NUTRITION_CERTIFICATION_PATH;
  const alreadyFully =
    before?.onboardingTrackCpt &&
    before.onboardingTrackNutrition &&
    before.certificationReviewStatus === "APPROVED" &&
    before.nutritionistCertificationReviewStatus === "APPROVED" &&
    Boolean(before.certificationUrl?.trim()) &&
    Boolean(before.nutritionistCertificationUrl?.trim());
  if (alreadyFully) {
    return false;
  }

  await prisma.trainerProfile.update({
    where: { trainerId },
    data: {
      onboardingTrackCpt: true,
      onboardingTrackNutrition: true,
      certificationReviewStatus: "APPROVED",
      nutritionistCertificationReviewStatus: "APPROVED",
      certificationUrl: cptUrl,
      nutritionistCertificationUrl: nutUrl,
    },
  });
  await maybeActivateTrainerDashboard(trainerId);
  return true;
}
