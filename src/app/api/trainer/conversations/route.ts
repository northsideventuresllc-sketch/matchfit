import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { isTrainerClientPairBlocked } from "@/lib/user-block-queries";
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

    const convs = await prisma.trainerClientConversation.findMany({
      where: { trainerId },
      orderBy: { updatedAt: "desc" },
      take: 120,
      include: {
        client: {
          select: {
            username: true,
            preferredName: true,
            firstName: true,
            lastName: true,
            profileImageUrl: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, authorRole: true, createdAt: true },
        },
      },
    });

    const threads = [];
    for (const c of convs) {
      if (await isTrainerClientPairBlocked(trainerId, c.clientId)) continue;
      const last = c.messages[0];
      threads.push({
        clientUsername: c.client.username,
        displayName: displayClientName(c.client),
        profileImageUrl: c.client.profileImageUrl,
        relationshipStage: c.relationshipStage,
        officialChatStartedAt: c.officialChatStartedAt?.toISOString() ?? null,
        lastMessagePreview: last ? last.body.slice(0, 160) : null,
        lastMessageAt: last?.createdAt.toISOString() ?? c.updatedAt.toISOString(),
      });
    }

    return NextResponse.json({ threads });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load conversations." }, { status: 500 });
  }
}
