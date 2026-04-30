import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import {
  FREE_TRAINER_NUDGES_PER_DAY,
  PREMIUM_NUDGES_PRODUCT_NOTICE,
  utcDayRange,
} from "@/lib/trainer-nudge-limits";
import { NextResponse } from "next/server";

const MAX_MESSAGE = 500;

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        profile: {
          select: {
            dashboardActivatedAt: true,
            premiumStudioEnabledAt: true,
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
      return NextResponse.json({ error: "Your trainer profile must be live before you can nudge clients." }, { status: 403 });
    }

    const body = (await req.json()) as { clientUsername?: string; message?: string | null };
    const handle = body.clientUsername?.trim();
    if (!handle) {
      return NextResponse.json({ error: "clientUsername is required." }, { status: 400 });
    }
    const message =
      typeof body.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE) : null;
    if (message === "") {
      return NextResponse.json({ error: "Message cannot be empty when provided." }, { status: 400 });
    }

    const client = await prisma.client.findUnique({
      where: { username: handle },
      select: { id: true, allowTrainerDiscovery: true, matchPreferencesCompletedAt: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }
    if (!client.allowTrainerDiscovery) {
      return NextResponse.json({ error: "This client is not accepting discovery nudges." }, { status: 403 });
    }
    if (!client.matchPreferencesCompletedAt) {
      return NextResponse.json({ error: "This client has not finished onboarding yet." }, { status: 403 });
    }

    const isPremium = Boolean(trainer.profile.premiumStudioEnabledAt);
    const { start, end } = utcDayRange();
    const nudgesToday = await prisma.trainerClientNudge.count({
      where: { trainerId: trainer.id, createdAt: { gte: start, lt: end } },
    });
    if (!isPremium && nudgesToday >= FREE_TRAINER_NUDGES_PER_DAY) {
      return NextResponse.json(
        {
          error: `You have used all ${FREE_TRAINER_NUDGES_PER_DAY} free discovery nudges for today.`,
          code: "NUDGE_DAILY_CAP",
          premiumNotice: PREMIUM_NUDGES_PRODUCT_NOTICE,
        },
        { status: 429 },
      );
    }

    const coachName =
      trainer.preferredName?.trim() ||
      [trainer.firstName, trainer.lastName].filter(Boolean).join(" ").trim() ||
      "A coach";
    const now = new Date();
    const msgLine = message ? ` “${message}”` : "";
    await prisma.$transaction([
      prisma.trainerClientNudge.create({
        data: {
          trainerId: trainer.id,
          clientId: client.id,
          message: message ?? null,
        },
      }),
      prisma.trainerClientConversation.upsert({
        where: { trainerId_clientId: { trainerId: trainer.id, clientId: client.id } },
        create: {
          trainerId: trainer.id,
          clientId: client.id,
          officialChatStartedAt: now,
          relationshipStage: "POTENTIAL_CLIENT",
        },
        update: {
          officialChatStartedAt: now,
          updatedAt: now,
        },
      }),
      prisma.clientNotification.create({
        data: {
          clientId: client.id,
          kind: "NUDGE",
          title: "NEW NUDGE",
          body: `${coachName} wants to work with you.${msgLine}`,
          linkHref: `/client/messages/${encodeURIComponent(trainer.username)}`,
        },
      }),
    ]);

    if (isPremium) {
      return NextResponse.json({
        ok: true,
        unlimitedNudges: true,
      });
    }
    return NextResponse.json({
      ok: true,
      nudgesUsedToday: nudgesToday + 1,
      nudgesDailyLimit: FREE_TRAINER_NUDGES_PER_DAY,
      premiumNotice: PREMIUM_NUDGES_PRODUCT_NOTICE,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not send nudge." }, { status: 500 });
  }
}
