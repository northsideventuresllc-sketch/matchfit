import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { isTrainerClientInteractionRestricted } from "@/lib/user-block-queries";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: {
        username: true,
        firstName: true,
        lastName: true,
        preferredName: true,
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
      return NextResponse.json({ error: "Your trainer profile must be live." }, { status: 403 });
    }

    const body = (await req.json()) as { clientUsername?: string; decision?: string };
    const handle = body.clientUsername?.trim();
    const decision = body.decision?.trim().toUpperCase();
    if (!handle || (decision !== "ACCEPT" && decision !== "DECLINE")) {
      return NextResponse.json({ error: "clientUsername and decision (ACCEPT | DECLINE) are required." }, { status: 400 });
    }

    const client = await prisma.client.findUnique({
      where: { username: handle },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    if (await isTrainerClientInteractionRestricted(trainerId, client.id)) {
      return NextResponse.json({ error: "You cannot respond to this inquiry." }, { status: 403 });
    }

    const row = await prisma.clientSavedTrainer.findUnique({
      where: { clientId_trainerId: { clientId: client.id, trainerId } },
    });
    if (!row || row.trainerInquiryStatus !== "PENDING_TRAINER") {
      return NextResponse.json({ error: "No pending inquiry for this client." }, { status: 404 });
    }

    const now = new Date();
    const coachLabel =
      trainer.preferredName?.trim() ||
      [trainer.firstName, trainer.lastName].filter(Boolean).join(" ").trim() ||
      "Your coach";

    if (decision === "DECLINE") {
      await prisma.$transaction([
        prisma.clientSavedTrainer.update({
          where: { id: row.id },
          data: { trainerInquiryStatus: "DECLINED" },
        }),
        prisma.clientNotification.create({
          data: {
            clientId: client.id,
            kind: "SYSTEM",
            title: "Coach update",
            body: `${coachLabel} (@${trainer.username}) was not able to take new clients from your inquiry. You can keep browsing Find Coaches.`,
            linkHref: `/client/dashboard/find-trainers`,
          },
        }),
      ]);
      return NextResponse.json({ ok: true, decision: "DECLINED" });
    }

    await prisma.$transaction([
      prisma.clientSavedTrainer.update({
        where: { id: row.id },
        data: { trainerInquiryStatus: "ACCEPTED" },
      }),
      prisma.clientTrainerBrowsePass.deleteMany({ where: { clientId: client.id, trainerId } }),
      prisma.trainerClientBrowsePass.deleteMany({ where: { trainerId, clientId: client.id } }),
      prisma.trainerClientConversation.upsert({
        where: { trainerId_clientId: { trainerId, clientId: client.id } },
        create: {
          trainerId,
          clientId: client.id,
          officialChatStartedAt: now,
          relationshipStage: "POTENTIAL_CLIENT",
        },
        update: {
          officialChatStartedAt: now,
          relationshipStage: "POTENTIAL_CLIENT",
          archivedAt: null,
          archiveExpiresAt: null,
          unmatchInitiatedBy: null,
          updatedAt: now,
        },
      }),
      prisma.clientNotification.create({
        data: {
          clientId: client.id,
          kind: "SYSTEM",
          title: "You're connected",
          body: `${coachLabel} (@${trainer.username}) accepted your interest. You can message them in Chat.`,
          linkHref: `/client/messages/${encodeURIComponent(trainer.username)}`,
        },
      }),
    ]);

    return NextResponse.json({ ok: true, decision: "ACCEPTED" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not update inquiry." }, { status: 500 });
  }
}
