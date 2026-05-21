import { parseChatAttachmentJson } from "@/lib/chat-attachment";
import { runOutboundChatComplianceMonitoring } from "@/lib/chat-compliance-monitor";
import { getChatContactLeakageBlockReason } from "@/lib/chat-leakage-detection";
import { prisma } from "@/lib/prisma";
import {
  conversationArchiveMetaForActor,
  purgeExpiredArchivedConversations,
} from "@/lib/trainer-client-conversation-archive";
import { getSessionClientId } from "@/lib/session";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { canAuthorSendChatMessage } from "@/lib/trainer-client-chat-rules";
import { loadChatScopedClientPendingBookings } from "@/lib/marketplace-governance-overview";
import { buildClientChatTokenTipContext } from "@/lib/trainer-promo-tokens";
import { isTrainerClientChatBlocked } from "@/lib/user-block-queries";
import { isMatchFitInternalQaClientEmail } from "@/lib/match-fit-internal-qa";
import { maybeAppendInternalQaSyntheticChatReply } from "@/lib/internal-qa-chat-reply";
import { NextResponse } from "next/server";

const MAX_BODY = 4000;

type RouteContext = { params: Promise<{ username: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { username } = await ctx.params;
    const handle = decodeURIComponent(username).trim();
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
            backgroundCheckClearedAt: true,
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
      return NextResponse.json({ error: "Coach not found." }, { status: 404 });
    }

    if (await isTrainerClientChatBlocked(trainer.id, clientId)) {
      return NextResponse.json({ error: "Unavailable." }, { status: 403 });
    }

    await purgeExpiredArchivedConversations();

    const conv = await prisma.trainerClientConversation.findUnique({
      where: { trainerId_clientId: { trainerId: trainer.id, clientId } },
        select: {
        id: true,
        officialChatStartedAt: true,
        relationshipStage: true,
        archivedAt: true,
        archiveExpiresAt: true,
        unmatchInitiatedBy: true,
        blockFreeSessionBookingUntilRepurchase: true,
        messages: {
          orderBy: { createdAt: "asc" },
          take: 200,
          select: { id: true, authorRole: true, body: true, createdAt: true, attachmentJson: true },
        },
      },
    });

    const tokenTip = await buildClientChatTokenTipContext(clientId, trainer.id);
    const archive = conversationArchiveMetaForActor({
      conv: conv
        ? {
            archivedAt: conv.archivedAt,
            archiveExpiresAt: conv.archiveExpiresAt,
            unmatchInitiatedBy: conv.unmatchInitiatedBy,
          }
        : null,
      actor: "CLIENT",
    });

    const voiceCallEnabled = false;

    let pendingBookings: {
      id: string;
      status: string;
      sessionDelivery: string | null;
      scheduledStartAt: Date;
      scheduledEndAt: Date | null;
      inviteNote: string | null;
      videoConferenceJoinUrl: string | null;
      videoConferenceProvider: string | null;
    }[] = [];
    try {
      if (conv && !archive.archived) {
        pendingBookings = await loadChatScopedClientPendingBookings(trainer.id, clientId);
      }
    } catch (bookingErr) {
      console.error("[Match Fit client chat GET] chat-scoped bookings skipped (DB may be behind migrations)", bookingErr);
    }

    return NextResponse.json({
      conversationId: conv?.id ?? null,
      officialChatStartedAt: conv?.officialChatStartedAt?.toISOString() ?? null,
      relationshipStage: conv?.relationshipStage ?? "POTENTIAL_CLIENT",
      archived: archive.archived,
      canRevive: archive.canRevive,
      archiveExpiresAt: archive.archiveExpiresAt,
      unmatchInitiatedBy: archive.unmatchInitiatedBy,
      voiceCallEnabled,
      pendingBookings: pendingBookings.map((b) => ({
        id: b.id,
        status: b.status,
        sessionDelivery: b.sessionDelivery,
        startsAt: b.scheduledStartAt.toISOString(),
        endsAt: b.scheduledEndAt?.toISOString() ?? null,
        inviteNote: b.inviteNote,
        videoConferenceJoinUrl: b.videoConferenceJoinUrl,
        videoConferenceProvider: b.videoConferenceProvider,
      })),
      tokenTip,
      messages:
        conv?.messages.map((m) => ({
          id: m.id,
          authorRole: m.authorRole,
          body: m.body,
          createdAt: m.createdAt.toISOString(),
          attachment: parseChatAttachmentJson(m.attachmentJson),
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

    const { username } = await ctx.params;
    const handle = decodeURIComponent(username).trim();
    const trainer = await prisma.trainer.findUnique({
      where: { username: handle },
      select: {
        id: true,
        internalQaSyntheticPersona: true,
        profile: {
          select: {
            dashboardActivatedAt: true,
            hasSignedTOS: true,
            hasUploadedW9: true,
            backgroundCheckStatus: true,
            backgroundCheckClearedAt: true,
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
      return NextResponse.json({ error: "Coach not found." }, { status: 404 });
    }

    if (await isTrainerClientChatBlocked(trainer.id, clientId)) {
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
    if (conv?.archivedAt) {
      return NextResponse.json({ error: "This chat is archived. Revive it if you are the person who archived it." }, { status: 403 });
    }
    if (!conv?.officialChatStartedAt) {
      return NextResponse.json(
        { error: "This chat opens after the coach accepts your interest, or after they send you a nudge." },
        { status: 403 },
      );
    }

    const prior = await prisma.trainerClientChatMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: "asc" },
      select: { authorRole: true },
    });
    const gate = canAuthorSendChatMessage(prior, "CLIENT");
    if (!gate.ok) {
      return NextResponse.json({ error: gate.reason }, { status: 429 });
    }

    const contactBlock = getChatContactLeakageBlockReason(text);
    if (contactBlock) {
      return NextResponse.json({ error: contactBlock, code: "CHAT_CONTACT_BLOCKED" }, { status: 400 });
    }

    await runOutboundChatComplianceMonitoring({
      conversationId: conv.id,
      authorRole: "CLIENT",
      body: text,
    });

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

    const me = await prisma.client.findUnique({
      where: { id: clientId },
      select: { email: true },
    });
    if (trainer.internalQaSyntheticPersona && isMatchFitInternalQaClientEmail(me?.email)) {
      await maybeAppendInternalQaSyntheticChatReply({
        conversationId: conv.id,
        trainerIsSynthetic: true,
        clientIsSynthetic: false,
        lastAuthorRole: "CLIENT",
        lastBody: text,
      });
    }

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
