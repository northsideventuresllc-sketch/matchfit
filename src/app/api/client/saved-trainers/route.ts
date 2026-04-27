import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
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
                certificationReviewStatus: true,
                nutritionistCertificationReviewStatus: true,
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
            certificationReviewStatus: true,
            nutritionistCertificationReviewStatus: true,
          },
        },
      },
    });
    if (!trainer?.profile || trainer.profile.dashboardActivatedAt == null || !isTrainerComplianceComplete(trainer.profile)) {
      return NextResponse.json({ error: "Coach not found or not available." }, { status: 404 });
    }

    const prior = await prisma.clientSavedTrainer.findUnique({
      where: { clientId_trainerId: { clientId, trainerId: trainer.id } },
    });

    const coachName = coachDisplayName(trainer);

    await prisma.$transaction(async (tx) => {
      await tx.clientSavedTrainer.upsert({
        where: {
          clientId_trainerId: { clientId, trainerId: trainer.id },
        },
        create: { clientId, trainerId: trainer.id, trainerInquiryStatus: "PENDING_TRAINER" },
        update: { trainerInquiryStatus: "PENDING_TRAINER" },
      });
      if (!prior) {
        await tx.clientNotification.create({
          data: {
            clientId,
            kind: "NEW_MATCH",
            title: "NEW FITNESS MATCH",
            body: `You saved ${coachName} (@${trainer.username}) to your list.`,
            linkHref: `/trainers/${encodeURIComponent(trainer.username)}`,
          },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not save coach." }, { status: 500 });
  }
}
