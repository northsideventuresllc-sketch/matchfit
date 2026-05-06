import { parseChatAttachmentJson } from "@/lib/chat-attachment";
import { runOutboundChatComplianceMonitoring } from "@/lib/chat-compliance-monitor";
import { prisma } from "@/lib/prisma";
import {
  conversationArchiveMetaForActor,
  purgeExpiredArchivedConversations,
} from "@/lib/trainer-client-conversation-archive";
import { getSessionTrainerId } from "@/lib/session";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { getPhoneCallEligibility } from "@/lib/phone-bridge-eligibility";
import { loadCheckInSessionsForThread } from "@/lib/chat-check-in-thread-snapshot";
import { getConversationBookingSnapshot } from "@/lib/trainer-client-booking-credits";
import { canAuthorSendChatMessage } from "@/lib/trainer-client-chat-rules";
import { computeTrainerCheckoutHint } from "@/lib/trainer-chat-checkout-hint";
import { BILLING_UNIT_LABELS, type BillingUnit } from "@/lib/trainer-match-questionnaire";
import { parseTrainerServiceOfferingsJson, resolvedTrainerServicePublicTitle } from "@/lib/trainer-service-offerings";
import { isTrainerClientChatBlocked } from "@/lib/user-block-queries";
import { NextResponse } from "next/server";

const MAX_BODY = 4000;

type RouteContext = { params: Promise<{ clientUsername: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { clientUsername } = await ctx.params;
    const handle = decodeURIComponent(clientUsername).trim();
    if (!handle) {
      return NextResponse.json({ error: "Invalid client." }, { status: 400 });
    }

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

    const [conv, profileExtras] = await Promise.all([
      prisma.trainerClientConversation.findUnique({
        where: { trainerId_clientId: { trainerId, clientId: client.id } },
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
      }),
      prisma.trainerProfile.findUnique({
        where: { trainerId },
        select: { serviceOfferingsJson: true, premiumStudioEnabledAt: true },
      }),
    ]);

    const premiumStudio = Boolean(profileExtras?.premiumStudioEnabledAt);
    const offeringsDoc = parseTrainerServiceOfferingsJson(profileExtras?.serviceOfferingsJson ?? null);
    const publishedServices = offeringsDoc.services.map((s) => ({
      serviceId: s.serviceId,
      title: resolvedTrainerServicePublicTitle(s),
      priceUsd: s.priceUsd,
      billingLabel: BILLING_UNIT_LABELS[s.billingUnit as BillingUnit] ?? s.billingUnit,
    }));

    const shareableFitHubPosts = premiumStudio
      ? await prisma.trainerFitHubPost.findMany({
          where: { trainerId, visibility: "PUBLIC" },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            caption: true,
            bodyText: true,
            postType: true,
            mediaUrl: true,
            createdAt: true,
          },
        })
      : [];

    const archive = conversationArchiveMetaForActor({
      conv: conv
        ? {
            archivedAt: conv.archivedAt,
            archiveExpiresAt: conv.archiveExpiresAt,
            unmatchInitiatedBy: conv.unmatchInitiatedBy,
          }
        : null,
      actor: "TRAINER",
    });

    const msgs = conv?.messages ?? [];
    const clientMsgs = msgs.filter((m) => m.authorRole === "CLIENT");
    const lastClientMessageId = clientMsgs.length ? clientMsgs[clientMsgs.length - 1]!.id : null;
    const checkoutHint = computeTrainerCheckoutHint({
      conversationId: conv?.id ?? null,
      messages: msgs.map((m) => ({ authorRole: m.authorRole, body: m.body })),
      publishedServices,
      lastClientMessageId,
    });

    let phoneCall: Awaited<ReturnType<typeof getPhoneCallEligibility>>;
    try {
      phoneCall = await getPhoneCallEligibility({
        clientId: client.id,
        trainerId,
        archived: archive.archived,
      });
    } catch (phoneErr) {
      console.error("[Match Fit trainer chat GET] phone eligibility skipped (DB may be behind migrations)", phoneErr);
      phoneCall = {
        paid: false,
        twilioConfigured: false,
        clientOptIn: false,
        trainerOptIn: false,
        ready: false,
        archived: archive.archived,
      };
    }
    const voiceCallEnabled = phoneCall.ready;

    let bookingSnapshot: Awaited<ReturnType<typeof getConversationBookingSnapshot>> | null = null;
    let checkInThread: Awaited<ReturnType<typeof loadCheckInSessionsForThread>> | null = null;
    let videoOAuthProviders: { provider: string }[] = [];
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
      bookingSnapshot = conv ? await getConversationBookingSnapshot(trainerId, client.id) : null;
    } catch (snapErr) {
      console.error("[Match Fit trainer chat GET] booking snapshot skipped (DB may be behind migrations)", snapErr);
    }
    try {
      if (conv && !archive.archived) {
        checkInThread = await loadCheckInSessionsForThread({ trainerId, clientId: client.id });
      }
    } catch (checkInErr) {
      console.error("[Match Fit trainer chat GET] check-in snapshot skipped (DB may be behind migrations)", checkInErr);
    }
    try {
      videoOAuthProviders = await prisma.trainerVideoConferenceConnection.findMany({
        where: { trainerId, revokedAt: null },
        select: { provider: true },
      });
    } catch (oauthErr) {
      console.error("[Match Fit trainer chat GET] video OAuth list skipped", oauthErr);
    }
    try {
      if (conv && !archive.archived) {
        const horizon = new Date(Date.now() - 6 * 60 * 60 * 1000);
        pendingBookings = await prisma.bookedTrainingSession.findMany({
          where: {
            trainerId,
            clientId: client.id,
            scheduledStartAt: { gte: horizon },
            OR: [
              { status: { in: ["INVITED", "PENDING_CONFIRMATION"] } },
              { status: "CLIENT_CONFIRMED", videoConferenceJoinUrl: { not: null } },
              {
                status: "CLIENT_CONFIRMED",
                fulfillmentStatus: { in: ["NONE", "SCHEDULED", "CHECK_IN_ACTIVE", "AWAITING_CLIENT_FOLLOWUP"] },
              },
            ],
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
        });
      }
    } catch (sessionsErr) {
      console.error("[Match Fit trainer chat GET] pending sessions skipped (DB may be behind migrations)", sessionsErr);
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
      phoneCall: {
        ready: phoneCall.ready,
        paid: phoneCall.paid,
        twilioConfigured: phoneCall.twilioConfigured,
        clientOptIn: phoneCall.clientOptIn,
        trainerOptIn: phoneCall.trainerOptIn,
      },
      bookingSnapshot,
      blockFreeSessionBookingUntilRepurchase: conv?.blockFreeSessionBookingUntilRepurchase ?? false,
      checkInThread,
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
      trainerPremiumStudio: premiumStudio,
      publishedServices,
      shareableFitHubPosts: shareableFitHubPosts.map((p) => ({
        id: p.id,
        postType: p.postType,
        mediaUrl: p.mediaUrl,
        preview: (p.caption?.trim() || p.bodyText?.trim() || "(No caption)").slice(0, 120),
        createdAt: p.createdAt.toISOString(),
      })),
      checkoutHint,
      videoOAuthProviders: videoOAuthProviders.map((v) => v.provider),
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
      where: { trainerId_clientId: { trainerId, clientId: client.id } },
    });
    if (conv?.archivedAt) {
      return NextResponse.json({ error: "This chat is archived. Revive it if you are the person who archived it." }, { status: 403 });
    }
    if (!conv?.officialChatStartedAt) {
      return NextResponse.json(
        { error: "This chat is not open yet. Accept the client’s inquiry (or wait for them to respond to your nudge)." },
        { status: 403 },
      );
    }

    const prior = await prisma.trainerClientChatMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: "asc" },
      select: { authorRole: true },
    });
    const gate = canAuthorSendChatMessage(prior, "TRAINER");
    if (!gate.ok) {
      return NextResponse.json({ error: gate.reason }, { status: 429 });
    }

    await runOutboundChatComplianceMonitoring({
      conversationId: conv.id,
      authorRole: "TRAINER",
      body: text,
    });

    const msg = await prisma.trainerClientChatMessage.create({
      data: {
        conversationId: conv.id,
        authorRole: "TRAINER",
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
