import { CONVERSATION_RELATIONSHIP_STAGES, type ConversationRelationshipStage } from "@/lib/safety-constants";
import { prisma } from "@/lib/prisma";
import { purgeExpiredArchivedConversations } from "@/lib/trainer-client-conversation-archive";
import { getSessionTrainerId } from "@/lib/session";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { isTrainerClientChatBlocked } from "@/lib/user-block-queries";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ clientUsername: string }> };

export async function PATCH(req: Request, ctx: RouteContext) {
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

    const { clientUsername } = await ctx.params;
    const handle = decodeURIComponent(clientUsername).trim();
    const client = await prisma.client.findUnique({
      where: { username: handle },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    if (await isTrainerClientChatBlocked(trainerId, client.id)) {
      return NextResponse.json({ error: "Unavailable." }, { status: 403 });
    }

    await purgeExpiredArchivedConversations();

    const body = (await req.json()) as { relationshipStage?: string };
    const raw = body.relationshipStage?.trim().toUpperCase() ?? "";
    if (!(CONVERSATION_RELATIONSHIP_STAGES as readonly string[]).includes(raw)) {
      return NextResponse.json({ error: "Invalid relationship stage." }, { status: 400 });
    }
    const stage = raw as ConversationRelationshipStage;

    const conv = await prisma.trainerClientConversation.findUnique({
      where: { trainerId_clientId: { trainerId, clientId: client.id } },
    });
    if (!conv) {
      return NextResponse.json({ error: "No conversation for this client yet." }, { status: 404 });
    }
    if (conv.archivedAt) {
      return NextResponse.json(
        { error: "This chat is archived. Only the person who archived it can revive it from Archives." },
        { status: 403 },
      );
    }

    await prisma.trainerClientConversation.update({
      where: { id: conv.id },
      data: { relationshipStage: stage, updatedAt: new Date() },
    });

    return NextResponse.json({ ok: true, relationshipStage: stage });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not update conversation." }, { status: 500 });
  }
}
