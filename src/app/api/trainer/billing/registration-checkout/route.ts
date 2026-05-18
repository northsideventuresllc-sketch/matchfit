import { NextResponse } from "next/server";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { createTrainerRegistrationFeeCheckoutSession } from "@/lib/trainer-registration-checkout";
import { certificationsGatePassed } from "@/lib/trainer-onboarding-cert-gate";
import { getSessionTrainerId } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { email: true, safetySuspended: true },
    });
    if (!trainer || trainer.safetySuspended) {
      return NextResponse.json({ error: "Unavailable." }, { status: 403 });
    }

    const profile = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: {
        hasPaidRegistrationFee: true,
        hasPaidBackgroundFee: true,
        backgroundCheckVendorPaidCents: true,
        backgroundCheckStatus: true,
        registrationFeePricingMode: true,
        certificationReviewStatus: true,
        onboardingTrackCpt: true,
        onboardingTrackNutrition: true,
        onboardingTrackSpecialist: true,
        nutritionistCertificationReviewStatus: true,
        specialistCertificationReviewStatus: true,
      },
    });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }
    if (profile.hasPaidRegistrationFee) {
      return NextResponse.json({ error: "Registration fee already paid." }, { status: 400 });
    }
    if (!certificationsGatePassed(profile)) {
      return NextResponse.json({ error: "Complete certification review before paying the registration fee." }, { status: 400 });
    }
    if (profile.backgroundCheckStatus !== "APPROVED" || !profile.hasPaidBackgroundFee) {
      return NextResponse.json({ error: "Background check must be cleared and paid before registration billing." }, { status: 400 });
    }
    const bgCents = profile.backgroundCheckVendorPaidCents ?? 0;
    if (bgCents <= 0) {
      return NextResponse.json({ error: "Background check amount is not on file yet." }, { status: 400 });
    }

    const origin = getAppOriginFromRequest(req);
    const pricingMode =
      profile.registrationFeePricingMode === "STANDARD_100_MINUS_BG"
        ? "STANDARD_100_MINUS_BG"
        : "FOUNDING_BG_SURCHARGE_20PCT";

    const { url, dueCents } = await createTrainerRegistrationFeeCheckoutSession({
      trainerId,
      email: trainer.email,
      pricingMode,
      backgroundCheckVendorPaidCents: bgCents,
      successUrl: `${origin}/trainer/dashboard/compliance?registration_paid=1`,
      cancelUrl: `${origin}/trainer/dashboard/compliance?registration_canceled=1`,
    });

    return NextResponse.json({ url, dueCents });
  } catch (e) {
    console.error("[trainer registration checkout]", e);
    const msg = e instanceof Error ? e.message : "Could not start checkout.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
