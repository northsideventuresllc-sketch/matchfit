import { prisma } from "@/lib/prisma";
import { syncDevelopmentTestTrainerCertificationsForTrainer } from "@/lib/trainer-dev-test-cert-sync";
import { getSessionTrainerId } from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

const trainerMeSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  phone: true,
  email: true,
  bio: true,
  preferredName: true,
  pronouns: true,
  ethnicity: true,
  languagesSpoken: true,
  fitnessNiches: true,
  yearsCoaching: true,
  genderIdentity: true,
  profileImageUrl: true,
  socialInstagram: true,
  socialTiktok: true,
  socialFacebook: true,
  socialLinkedin: true,
  socialOtherUrl: true,
  profile: {
    select: {
      hasSignedTOS: true,
      hasUploadedW9: true,
      hasPaidBackgroundFee: true,
      backgroundCheckStatus: true,
      certificationUrl: true,
      otherCertificationUrl: true,
      nutritionistCertificationUrl: true,
      certificationReviewStatus: true,
      nutritionistCertificationReviewStatus: true,
      onboardingTrackCpt: true,
      onboardingTrackNutrition: true,
      backgroundCheckReviewStatus: true,
      dashboardActivatedAt: true,
      matchQuestionnaireStatus: true,
      matchQuestionnaireAnswers: true,
      matchQuestionnaireCompletedAt: true,
      aiMatchProfileText: true,
    },
  },
} as const;

export async function GET() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    let trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: trainerMeSelect,
    });

    if (!trainer) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (!trainer.profile) {
      await prisma.trainerProfile.create({
        data: {
          trainerId: trainer.id,
          backgroundCheckStatus: "NOT_STARTED",
          certificationReviewStatus: "NOT_STARTED",
          nutritionistCertificationReviewStatus: "NOT_STARTED",
          backgroundCheckReviewStatus: "NOT_STARTED",
          onboardingTrackCpt: false,
          onboardingTrackNutrition: false,
        },
      });
      trainer = await prisma.trainer.findUnique({
        where: { id: trainerId },
        select: trainerMeSelect,
      });
      if (!trainer) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
    }

    const synced = await syncDevelopmentTestTrainerCertificationsForTrainer({
      id: trainer.id,
      username: trainer.username,
      email: trainer.email,
      phone: trainer.phone,
    });
    if (synced) {
      trainer = await prisma.trainer.findUnique({
        where: { id: trainerId },
        select: trainerMeSelect,
      });
      if (!trainer) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
    }

    return NextResponse.json({ trainer });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not load your account.", {
      logLabel: "[Match Fit trainer me]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
