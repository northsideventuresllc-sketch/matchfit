import { runOutboundChatComplianceMonitoring } from "@/lib/chat-compliance-monitor";
import { prisma } from "@/lib/prisma";
import {
  conversationArchiveMetaForActor,
  purgeExpiredArchivedConversations,
} from "@/lib/trainer-client-conversation-archive";
import { getSessionClientId } from "@/lib/session";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { canAuthorSendChatMessage } from "@/lib/trainer-client-chat-rules";
import { getPhoneCallEligibility } from "@/lib/phone-bridge-eligibility";
import { getConversationBookingSnapshot } from "@/lib/trainer-client-booking-credits";
import { buildClientChatTokenTipContext } from "@/lib/trainer-promo-tokens";
import { isTrainerClientChatBlocked } from "@/lib/user-block-queries";
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
        messages: {
          orderBy: { createdAt: "asc" },
          take: 200,
          select: { id: true, authorRole: true, body: true, createdAt: true },
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

    const phoneCall = await getPhoneCallEligibility({
      clientId,
      trainerId: trainer.id,
      archived: archive.archived,
    });
    const voiceCallEnabled = phoneCall.ready;
    const bookingSnapshot = conv ? await getConversationBookingSnapshot(trainer.id, clientId) : null;
    const horizon = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const pendingBookings =
      conv && !archive.archived
        ? await prisma.bookedTrainingSession.findMany({
            where: {
              trainerId: trainer.id,
              clientId,
              scheduledStartAt: { gte: horizon },
              OR: [{ status: "INVITED" }, { status: "CLIENT_CONFIRMED", videoConferenceJoinUrl: { not: null } }],
            },
            orderBy: { scheduledStartAt: "asc" },
            take: 12,
            select: {
              id: true,
              status: true,
              sessionDelivery: true,
              scheduledStartAt: true,
              scheduledEndAt: true,
              inviteNote: true,
              videoConferenceJoinUrl: true,
              videoConferenceProvider: true,
            },
          })
        : [];

    return NextResponse.json({
      conversationId: conv?.id ?? null,
      officialChatStartedAt: conv?.officialChatStartedAt?.toISOString() ?? null,
      relationshipStage: conv?.relationshipStage ?? "POTENTIAL_CLIENT",
      archived: archive.archived,
      canRevive: archive.canRevive,
      archiveExpiresAt: archive.archiveExpiresAt,
      unmatchInitiatedBy: archive.unmatchInitiatedBy,
      voiceCallEnabled,
      phoneCall: {
        ready: phoneCall.ready,
        paid: phoneCall.paid,
        twilioConfigured: phoneCall.twilioConfigured,
        clientOptIn: phoneCall.clientOptIn,
        trainerOptIn: phoneCall.trainerOptIn,
      },
      bookingSnapshot,
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
