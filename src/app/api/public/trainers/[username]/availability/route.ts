import { prisma } from "@/lib/prisma";
import { summarizeTrainerAvailabilityForPublic } from "@/lib/booking-availability";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ username: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { username } = await ctx.params;
    const handle = decodeURIComponent(username).trim();
    const trainer = await prisma.trainer.findUnique({
      where: { username: handle },
      select: {
        deidentifiedAt: true,
        profile: {
          select: {
            dashboardActivatedAt: true,
            hasSignedTOS: true,
            hasUploadedW9: true,
            backgroundCheckStatus: true,
            backgroundCheckClearedAt: true,
            onboardingTrackCpt: true,
            onboardingTrackNutrition: true,
            onboardingTrackSpecialist: true,
            certificationReviewStatus: true,
            nutritionistCertificationReviewStatus: true,
            specialistCertificationReviewStatus: true,
            bookingAvailabilityJson: true,
            bookingTimezone: true,
          },
        },
      },
    });
    const profile = trainer?.profile ?? null;
    const published =
      trainer &&
      !trainer.deidentifiedAt &&
      profile &&
      profile.dashboardActivatedAt != null &&
      isTrainerComplianceComplete(profile);
    if (!published) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const tz = profile.bookingTimezone?.trim() || "America/New_York";
    const summary = summarizeTrainerAvailabilityForPublic(profile.bookingAvailabilityJson, tz);
    return NextResponse.json({ mode: summary.mode, lines: summary.lines, timezone: tz });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load availability." }, { status: 500 });
  }
}
