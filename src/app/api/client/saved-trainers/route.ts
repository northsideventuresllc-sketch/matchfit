import { getAppOriginFromRequest } from "@/lib/app-origin";
import { prisma } from "@/lib/prisma";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { sendTransactionalEmailIfAllowed } from "@/lib/transactional-email-send";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

function coachDisplayName(trainer: {
  preferredName: string | null;
  firstName: string;
  lastName: string;
}): string {
  return (
    trainer.preferredName?.trim() ||
    [trainer.firstName, trainer.lastName].filter(Boolean).join(" ").trim() ||
    "Coach"
  );
}

export async function GET() {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const rows = await prisma.clientSavedTrainer.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      include: {
        trainer: {
          select: {
            username: true,
            firstName: true,
            lastName: true,
            preferredName: true,
            profileImageUrl: true,
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
        },
      },
    });

    const saved = rows
      .filter(
        (r) =>
          r.trainer.profile &&
          r.trainer.profile.dashboardActivatedAt != null &&
          isTrainerComplianceComplete(r.trainer.profile),
      )
      .map((r) => ({
        trainerUsername: r.trainer.username,
        displayName: coachDisplayName(r.trainer),
        profileImageUrl: r.trainer.profileImageUrl,
        savedAt: r.createdAt.toISOString(),
      }));

    return NextResponse.json({ saved });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load saved coaches." }, { status: 500 });
  }
}

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
        username: true,
        email: true,
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
      return NextResponse.json({ error: "Coach not found or not available." }, { status: 404 });
    }

    const prior = await prisma.clientSavedTrainer.findUnique({
      where: { clientId_trainerId: { clientId, trainerId: trainer.id } },
      select: { id: true, trainerInquiryStatus: true },
    });

    const coachName = coachDisplayName(trainer);

    await prisma.$transaction(async (tx) => {
      await tx.clientTrainerBrowsePass.deleteMany({
        where: { clientId, trainerId: trainer.id },
      });
      await tx.clientSavedTrainer.upsert({
        where: {
          clientId_trainerId: { clientId, trainerId: trainer.id },
        },
        create: { clientId, trainerId: trainer.id, trainerInquiryStatus: "PENDING_TRAINER" },
        update: { trainerInquiryStatus: "PENDING_TRAINER" },
      });
      const reactivatedInquiry = prior && prior.trainerInquiryStatus !== "PENDING_TRAINER";
      if (!prior) {
        await tx.clientNotification.create({
          data: {
            clientId,
            kind: "NEW_MATCH",
            title: "Coach interest sent",
            body: `We let ${coachName} (@${trainer.username}) know you're interested. You'll get another notice when they respond.`,
            linkHref: `/client/dashboard/find-trainers`,
          },
        });
      }
      if (!prior || reactivatedInquiry) {
        await tx.trainerNotification.create({
          data: {
            trainerId: trainer.id,
            kind: "INQUIRY",
            title: "New client interest",
            body: `A client expressed interest in working with you. Accept or decline from Profile interests.`,
            linkHref: `/trainer/dashboard/interests`,
          },
        });
      }
    });

    const reactivatedInquiry = prior && prior.trainerInquiryStatus !== "PENDING_TRAINER";
    if (!prior || reactivatedInquiry) {
      const clientMini = await prisma.client.findUnique({
        where: { id: clientId },
        select: { username: true },
      });
      const origin = getAppOriginFromRequest(req);
      if (clientMini?.username?.trim() && trainer.email?.trim()) {
        void sendTransactionalEmailIfAllowed({
          kind: "NEW_CLIENT_INQUIRY",
          to: trainer.email.trim(),
          audience: "TRAINER",
          trainerId: trainer.id,
          variables: {
            clientUsername: clientMini.username.trim(),
            trainerDashboardUrl: `${origin}/trainer/dashboard`,
            interestsUrl: `${origin}/trainer/dashboard/interests`,
            inquiryNote: "A client expressed interest in working with you from Find Coaches.",
          },
        }).catch((e) => console.error("[saved-trainers] inquiry email failed:", e));
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not save coach." }, { status: 500 });
  }
}
