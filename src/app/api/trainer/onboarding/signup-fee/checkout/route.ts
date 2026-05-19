import { prisma } from "@/lib/prisma";
import { requireTrainerOnboardingMutation } from "@/lib/trainer-onboarding-api";
import {
  createTrainerSignupBalanceCheckoutSession,
  trainerOnboardingOriginFromRequest,
} from "@/lib/trainer-onboarding-stripe";
import { trainerSignupFeeBalanceDueCents } from "@/lib/trainer-onboarding-fees";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const session = await requireTrainerOnboardingMutation();
    if ("error" in session) {
      return NextResponse.json({ error: session.error }, { status: session.status });
    }
    const { trainerId } = session;

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: {
        email: true,
        launchCohortMember: true,
        profile: {
          select: {
            hasPaidBackgroundFee: true,
            backgroundCheckPaidCents: true,
            backgroundCheckStatus: true,
            signupFeeBalancePaidAt: true,
            certificationReviewStatus: true,
            nutritionistCertificationReviewStatus: true,
            specialistCertificationReviewStatus: true,
            onboardingTrackCpt: true,
            onboardingTrackNutrition: true,
            onboardingTrackSpecialist: true,
          },
        },
      },
    });
    if (!trainer?.profile) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!trainer.profile.hasPaidBackgroundFee) {
      return NextResponse.json({ error: "Pay for your background check first." }, { status: 400 });
    }
    if (trainer.profile.backgroundCheckStatus !== "APPROVED") {
      return NextResponse.json({ error: "Your background check must be cleared before paying the registration balance." }, { status: 400 });
    }
    const certOk =
      trainer.profile.certificationReviewStatus === "APPROVED" ||
      trainer.profile.nutritionistCertificationReviewStatus === "APPROVED" ||
      trainer.profile.specialistCertificationReviewStatus === "APPROVED";
    if (!certOk) {
      return NextResponse.json({ error: "Upload and verify your certification(s) before paying the registration balance." }, { status: 400 });
    }
    if (trainer.profile.signupFeeBalancePaidAt) {
      return NextResponse.json({ error: "Registration balance is already paid." }, { status: 400 });
    }

    const paid = trainer.profile.backgroundCheckPaidCents ?? 0;
    if (
      trainerSignupFeeBalanceDueCents({
        backgroundCheckPaidCents: paid,
        launchCohort: trainer.launchCohortMember,
      }) <= 0
    ) {
      await prisma.trainerProfile.update({
        where: { trainerId },
        data: { signupFeeBalancePaidAt: new Date() },
      });
      return NextResponse.json({ ok: true, waived: true });
    }

    const origin = trainerOnboardingOriginFromRequest(req);
    const url = await createTrainerSignupBalanceCheckoutSession({
      trainerId,
      email: trainer.email,
      backgroundCheckPaidCents: paid,
      launchCohort: trainer.launchCohortMember,
      origin,
    });
    return NextResponse.json({ url });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not start checkout.", {
      logLabel: "[Match Fit trainer signup fee checkout]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
