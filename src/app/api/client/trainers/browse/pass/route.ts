import { prisma } from "@/lib/prisma";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = (await req.json()) as { trainerUsername?: string };
    const handle = body.trainerUsername?.trim();
    if (!handle) {
      return NextResponse.json({ error: "trainerUsername is required." }, { status: 400 });
    }

    const trainer = await prisma.trainer.findUnique({
      where: { username: handle },
      select: {
        id: true,
        profile: {
          select: {
            dashboardActivatedAt: true,
            hasSignedTOS: true,
            hasUploadedW9: true,
            backgroundCheckStatus: true,
            onboardingTrackCpt: true,
            onboardingTrackNutrition: true,
            onboardingTrackSpecialist: true,
            certificationReviewStatus: true,
            nutritionistCertificationReviewStatus: true,
            specialistCertificationReviewStatus: true,
          },
        },
      },
    });
    if (!trainer?.profile || trainer.profile.dashboardActivatedAt == null || !isTrainerComplianceComplete(trainer.profile)) {
      return NextResponse.json({ error: "Coach not found or not available." }, { status: 404 });
    }

    const conv = await prisma.trainerClientConversation.findUnique({
      where: { trainerId_clientId: { trainerId: trainer.id, clientId } },
      select: { officialChatStartedAt: true },
    });
    if (conv?.officialChatStartedAt) {
      return NextResponse.json({ error: "You are already connected with this coach." }, { status: 400 });
    }

    const now = new Date();
    await prisma.clientTrainerBrowsePass.upsert({
      where: { clientId_trainerId: { clientId, trainerId: trainer.id } },
      create: { clientId, trainerId: trainer.id, lastPassedAt: now },
      update: { lastPassedAt: now },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not record pass." }, { status: 500 });
  }
}
