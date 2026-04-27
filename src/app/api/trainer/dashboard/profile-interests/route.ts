import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { NextResponse } from "next/server";

function displayClientName(c: { preferredName: string; firstName: string; lastName: string }): string {
  return c.preferredName?.trim() || [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "Client";
}

export async function GET() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: {
        profile: {
          select: {
            dashboardActivatedAt: true,
            hasSignedTOS: true,
            hasUploadedW9: true,
            backgroundCheckStatus: true,
            onboardingTrackCpt: true,
            onboardingTrackNutrition: true,
            certificationReviewStatus: true,
            nutritionistCertificationReviewStatus: true,
          },
        },
      },
    });
    if (!trainer?.profile || trainer.profile.dashboardActivatedAt == null || !isTrainerComplianceComplete(trainer.profile)) {
      return NextResponse.json({ error: "Your trainer profile must be live." }, { status: 403 });
    }

    const rows = await prisma.clientSavedTrainer.findMany({
      where: { trainerId, trainerInquiryStatus: "PENDING_TRAINER" },
      orderBy: { createdAt: "desc" },
      include: {
        client: {
          select: {
            username: true,
            preferredName: true,
            firstName: true,
            lastName: true,
            profileImageUrl: true,
            zipCode: true,
            bio: true,
          },
        },
      },
    });

    const interests = rows.map((r) => ({
      clientUsername: r.client.username,
      displayName: displayClientName(r.client),
      profileImageUrl: r.client.profileImageUrl,
      zipCode: r.client.zipCode,
      bio: r.client.bio,
      interestedAt: r.createdAt.toISOString(),
    }));

    return NextResponse.json({ interests });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load interests." }, { status: 500 });
  }
}
