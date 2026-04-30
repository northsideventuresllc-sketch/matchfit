import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { isTrainerClientPairBlocked } from "@/lib/user-block-queries";
import { buildClientChatTokenTipContext } from "@/lib/trainer-promo-tokens";
import { NextResponse } from "next/server";

const MAX_BODY = 4000;

type RouteContext = { params: Promise<{ trainerUsername: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { trainerUsername } = await ctx.params;
    const handle = decodeURIComponent(trainerUsername).trim();
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
            certificationReviewStatus: true,
            nutritionistCertificationReviewStatus: true,
          },
        },
      },
    });
    if (!trainer?.profile || trainer.profile.dashboardActivatedAt == null || !isTrainerComplianceComplete(trainer.profile)) {
      return NextResponse.json({ error: "Coach not found." }, { status: 404 });
    }

    if (await isTrainerClientPairBlocked(trainer.id, clientId)) {
      return NextResponse.json({ error: "Unavailable." }, { status: 403 });
    }

    const conv = await prisma.trainerClientConversation.findUnique({
      where: { trainerId_clientId: { trainerId: trainer.id, clientId } },
      select: {
        id: true,
        officialChatStartedAt: true,
        relationshipStage: true,
        messages: {
          orderBy: { createdAt: "asc" },
          take: 200,
          select: { id: true, authorRole: true, body: true, createdAt: true },
        },
      },
    });

    const tokenTip = await buildClientChatTokenTipContext(clientId, trainer.id);

    return NextResponse.json({
      conversationId: conv?.id ?? null,
      officialChatStartedAt: conv?.officialChatStartedAt?.toISOString() ?? null,
      relationshipStage: conv?.relationshipStage ?? "POTENTIAL_CLIENT",
      tokenTip,
      messages:
        conv?.messages.map((m) => ({
          id: m.id,
          authorRole: m.authorRole,
          body: m.body,
          createdAt: m.createdAt.toISOString(),
        })) ?? [],
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load messages." }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: RouteContext) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { trainerUsername } = await ctx.params;
    const handle = decodeURIComponent(trainerUsername).trim();
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
            certificationReviewStatus: true,
            nutritionistCertificationReviewStatus: true,
          },
        },
      },
    });
    if (!trainer?.profile || trainer.profile.dashboardActivatedAt == null || !isTrainerComplianceComplete(trainer.profile)) {
      return NextResponse.json({ error: "Coach not found." }, { status: 404 });
    }

    if (await isTrainerClientPairBlocked(trainer.id, clientId)) {
      return NextResponse.json({ error: "Messaging is blocked for this thread." }, { status: 403 });
    }

    const bodyRaw = (await req.json()) as { body?: string };
    const text = typeof bodyRaw.body === "string" ? bodyRaw.body.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "Message body is required." }, { status: 400 });
    }
    if (text.length > MAX_BODY) {
      return NextResponse.json({ error: `Message is too long (max ${MAX_BODY} characters).` }, { status: 400 });
    }

    const conv = await prisma.trainerClientConversation.findUnique({
      where: { trainerId_clientId: { trainerId: trainer.id, clientId } },
    });
    if (!conv?.officialChatStartedAt) {
      return NextResponse.json(
        { error: "This chat opens after the coach accepts your interest, or after they send you a nudge." },
        { status: 403 },
      );
    }

    const msg = await prisma.trainerClientChatMessage.create({
      data: {
        conversationId: conv.id,
        authorRole: "CLIENT",
        body: text,
      },
    });
    await prisma.trainerClientConversation.update({
      where: { id: conv.id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      message: {
        id: msg.id,
        authorRole: msg.authorRole,
        body: msg.body,
        createdAt: msg.createdAt.toISOString(),
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not send message." }, { status: 500 });
  }
}
