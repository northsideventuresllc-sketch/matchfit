import { getTrainerCheckrVault } from "@/lib/supabase/checkr-vault";
import { requireTrainerOnboardingSession } from "@/lib/trainer-onboarding-api";
import { prisma } from "@/lib/prisma";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await requireTrainerOnboardingSession();
    if ("error" in session) {
      return NextResponse.json({ error: session.error }, { status: session.status });
    }

    const profile = await prisma.trainerProfile.findUnique({
      where: { trainerId: session.trainerId },
      select: {
        backgroundCheckStatus: true,
        backgroundCheckReviewStatus: true,
        hasPaidBackgroundFee: true,
        checkrInvitationId: true,
        checkrReportId: true,
      },
    });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    const vault = await getTrainerCheckrVault(session.trainerId);

    return NextResponse.json({
      backgroundCheckStatus: profile.backgroundCheckStatus,
      backgroundCheckReviewStatus: profile.backgroundCheckReviewStatus,
      hasPaidBackgroundFee: profile.hasPaidBackgroundFee,
      checkrInvitationId: profile.checkrInvitationId,
      checkrReportId: profile.checkrReportId,
      reportPortalUrl: vault?.report_portal_url ?? null,
    });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not load screening status.", {
      logLabel: "[Match Fit trainer BG status]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
