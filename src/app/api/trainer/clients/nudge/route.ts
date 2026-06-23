import { queueChatAdminReview } from "@/lib/chat-admin-review-queue";
import { getChatContactLeakageBlockReason, scanChatTextForLeakageSignals } from "@/lib/chat-leakage-detection";
import {
  INDEPENDENT_FP_DAILY_NUDGES,
  INDEPENDENT_FP_NO_CHAT_MESSAGE,
  NUDGE_FEATURE_UNAVAILABLE_MESSAGE,
  NUDGE_PACK_PURCHASE_NOTICE,
  trainerCanUseNudgeFeature,
  trainerNudgeOpensChat,
} from "@/lib/fp-tier-chat-policy";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { hasTrainerFullPlatformAccess } from "@/lib/trainer-full-access";
import { trainerFullAccessBlockedMessage } from "@/lib/assert-trainer-full-access";
import { trainerFullAccessProfileSelect } from "@/lib/trainer-full-access-profile-select";
import {
  evaluateTrainerNudgeQuota,
  FP_NUDGE_PACK_SIZE,
  utcDayRange,
} from "@/lib/trainer-nudge-limits";
import { isMatchFitInternalQaTrainerEmail } from "@/lib/match-fit-internal-qa";
import { isClientHiddenFromPublicMarketplace } from "@/lib/match-fit-public-marketplace-hidden";
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
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        profile: {
          select: {
            ...trainerFullAccessProfileSelect,
            premiumStudioEnabledAt: true,
            accountTier: true,
            nudgeCreditsBalance: true,
          },
        },
      },
    });
    if (!trainer?.profile || !hasTrainerFullPlatformAccess(trainer.profile)) {
      return NextResponse.json({ error: trainerFullAccessBlockedMessage() }, { status: 403 });
    }

    const accountTier = trainer.profile.accountTier;
    if (!trainerCanUseNudgeFeature(accountTier)) {
      return NextResponse.json({ error: NUDGE_FEATURE_UNAVAILABLE_MESSAGE }, { status: 403 });
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
    if (message) {
      const contactBlock = getChatContactLeakageBlockReason(message, accountTier);
      if (contactBlock) {
        return NextResponse.json({ error: contactBlock, code: "CHAT_CONTACT_BLOCKED" }, { status: 400 });
      }
    }

    const client = await prisma.client.findUnique({
      where: { username: handle },
      select: {
        id: true,
        email: true,
        username: true,
        allowTrainerDiscovery: true,
        matchPreferencesCompletedAt: true,
        internalQaSyntheticPersona: true,
      },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }
    if (isClientHiddenFromPublicMarketplace(client) && !client.internalQaSyntheticPersona) {
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
    const quota = evaluateTrainerNudgeQuota({
      accountTier,
      nudgesUsedToday: nudgesToday,
      nudgeCreditsBalance: trainer.profile.nudgeCreditsBalance,
      legacyPremiumStudio: isPremium,
    });
    if (!quota.allowed) {
      if (quota.reason === "not_allowed") {
        return NextResponse.json({ error: NUDGE_FEATURE_UNAVAILABLE_MESSAGE }, { status: 403 });
      }
      return NextResponse.json(
        {
          error: `You have used all ${quota.dailyLimit ?? INDEPENDENT_FP_DAILY_NUDGES} discovery nudges for today.`,
          code: "NUDGE_DAILY_CAP",
          nudgesUsedToday: quota.nudgesUsedToday,
          nudgesDailyLimit: quota.dailyLimit,
          nudgeCreditsBalance: quota.nudgeCreditsBalance,
          nudgePackNotice: NUDGE_PACK_PURCHASE_NOTICE,
          nudgePackSize: FP_NUDGE_PACK_SIZE,
        },
        { status: 429 },
      );
    }

    const existingConv = await prisma.trainerClientConversation.findUnique({
      where: { trainerId_clientId: { trainerId: trainer.id, clientId: client.id } },
      select: { archivedAt: true },
    });
    if (existingConv?.archivedAt) {
      return NextResponse.json(
        {
          error:
            "This thread is archived. The client must revive the chat (if they ended it) or wait until the archive expires before a new nudge can be sent.",
        },
        { status: 403 },
      );
    }

    const coachName =
      trainer.preferredName?.trim() ||
      [trainer.firstName, trainer.lastName].filter(Boolean).join(" ").trim() ||
      "A Fitness Pro";
    const now = new Date();
    const msgLine = message ? ` “${message}”` : "";
    const opensChat = trainerNudgeOpensChat(accountTier);
    const clientLink = opensChat
      ? `/client/messages/${encodeURIComponent(trainer.username)}`
      : "/client/dashboard";

    const deferredSyntheticOpen =
      isMatchFitInternalQaTrainerEmail(trainer.email) && client.internalQaSyntheticPersona;

    if (deferredSyntheticOpen) {
      const openAt = new Date(now.getTime() + 60_000);
      const conv = await prisma.$transaction(async (tx) => {
        if (quota.usesPurchasedCredit) {
          await tx.trainerProfile.update({
            where: { trainerId: trainer.id },
            data: { nudgeCreditsBalance: { decrement: 1 } },
          });
        }
        await tx.trainerClientNudge.create({
          data: {
            trainerId: trainer.id,
            clientId: client.id,
            message: message ?? null,
          },
        });
        const c = await tx.trainerClientConversation.upsert({
          where: { trainerId_clientId: { trainerId: trainer.id, clientId: client.id } },
          create: {
            trainerId: trainer.id,
            clientId: client.id,
            officialChatStartedAt: null,
            relationshipStage: "POTENTIAL_CLIENT",
          },
          update: {
            officialChatStartedAt: null,
            updatedAt: now,
          },
        });
        await tx.internalQaDeferredOfficialChat.upsert({
          where: { conversationId: c.id },
          create: {
            conversationId: c.id,
            openAt,
          },
          update: {
            openAt,
            processedAt: null,
          },
        });
        await tx.clientNotification.create({
          data: {
            clientId: client.id,
            kind: "NUDGE",
            title: "NEW NUDGE",
            body: `${coachName} wants to work with you.${msgLine}`,
            linkHref: clientLink,
          },
        });
        return c;
      });

      if (message) {
        const leak = scanChatTextForLeakageSignals(message, accountTier);
        if (leak.flagged) {
          await queueChatAdminReview({
            conversationId: conv.id,
            authorRole: "TRAINER",
            signals: leak.signals,
            body: message,
          });
        }
      }

      return NextResponse.json({
        ok: true,
        chatDisabled: !opensChat,
        internalQaSyntheticMatchOpensAt: openAt.toISOString(),
      });
    }

    const conv = await prisma.$transaction(async (tx) => {
      if (quota.usesPurchasedCredit) {
        await tx.trainerProfile.update({
          where: { trainerId: trainer.id },
          data: { nudgeCreditsBalance: { decrement: 1 } },
        });
      }
      await tx.trainerClientNudge.create({
        data: {
          trainerId: trainer.id,
          clientId: client.id,
          message: message ?? null,
        },
      });
      const c = await tx.trainerClientConversation.upsert({
        where: { trainerId_clientId: { trainerId: trainer.id, clientId: client.id } },
        create: {
          trainerId: trainer.id,
          clientId: client.id,
          officialChatStartedAt: opensChat ? now : null,
          relationshipStage: "POTENTIAL_CLIENT",
        },
        update: {
          officialChatStartedAt: opensChat ? now : undefined,
          updatedAt: now,
        },
      });
      await tx.clientNotification.create({
        data: {
          clientId: client.id,
          kind: "NUDGE",
          title: "NEW NUDGE",
          body: `${coachName} wants to work with you.${msgLine}`,
          linkHref: clientLink,
        },
      });
      return c;
    });

    if (message) {
      const leak = scanChatTextForLeakageSignals(message, accountTier);
      if (leak.flagged) {
        await queueChatAdminReview({
          conversationId: conv.id,
          authorRole: "TRAINER",
          signals: leak.signals,
          body: message,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      chatDisabled: !opensChat,
      chatNotice: opensChat ? null : INDEPENDENT_FP_NO_CHAT_MESSAGE,
      nudgesUsedToday: nudgesToday + 1,
      nudgesDailyLimit: quota.dailyLimit,
      nudgeCreditsBalance: quota.usesPurchasedCredit
        ? Math.max(0, quota.nudgeCreditsBalance - 1)
        : quota.nudgeCreditsBalance,
      nudgePackNotice: accountTier === "independent_fitness_pro" ? NUDGE_PACK_PURCHASE_NOTICE : null,
      unlimitedNudges: quota.dailyLimit == null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not send nudge." }, { status: 500 });
  }
}
