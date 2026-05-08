import { prisma } from "@/lib/prisma";
import { refundCentsViaStripePaymentIntent } from "@/lib/session-check-in";

export type TrainerSuspensionReasonCode = "CLIENT_REPORT" | "PUNCH_STREAK" | "DISPUTE_VOLUME" | "ADMIN";

/**
 * Cancels upcoming bookings for a suspended trainer, refunds net ledger slices where a Stripe PI is known,
 * and notifies affected clients. Idempotent per booking (sets sessionClosedAt / CANCELLED).
 */
export async function applyTrainerMarketplaceSuspensionSideEffects(args: {
  trainerId: string;
  reasonCode: TrainerSuspensionReasonCode;
}): Promise<{ bookingsCancelled: number; refundsAttempted: number; clientsNotified: number }> {
  const now = new Date();
  const horizon = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const bookings = await prisma.bookedTrainingSession.findMany({
    where: {
      trainerId: args.trainerId,
      sessionClosedAt: null,
      scheduledStartAt: { gte: horizon },
      status: { in: ["INVITED", "CLIENT_CONFIRMED", "PENDING_CONFIRMATION"] },
    },
    select: {
      id: true,
      clientId: true,
      conversationId: true,
      status: true,
      allocatedCoachServiceCents: true,
      allocatedNetAddonCents: true,
      attributionStripePaymentIntentId: true,
    },
  });

  let refundsAttempted = 0;
  const notifiedClients = new Set<string>();

  for (const b of bookings) {
    const refundCents =
      b.status === "CLIENT_CONFIRMED" ? Math.max(0, b.allocatedCoachServiceCents + b.allocatedNetAddonCents) : 0;
    let refundId: string | null = null;
    if (refundCents > 0 && b.attributionStripePaymentIntentId?.trim()) {
      const res = await refundCentsViaStripePaymentIntent({
        paymentIntentId: b.attributionStripePaymentIntentId.trim(),
        amountCents: refundCents,
        idempotencyKey: `suspend-trainer:${args.reasonCode}:${b.id}`,
      });
      if ("ok" in res) {
        refundId = res.refundId;
        refundsAttempted += 1;
      }
    }

    await prisma.bookedTrainingSession.update({
      where: { id: b.id },
      data: {
        status: "CANCELLED",
        fulfillmentStatus: "CANCELLED_TRAINER_SUSPENDED",
        sessionClosedAt: now,
        lastStripeRefundId: refundId,
        lastStripeRefundCents: refundCents,
        updatedAt: now,
      },
    });

    if (!notifiedClients.has(b.clientId)) {
      notifiedClients.add(b.clientId);
      await prisma.clientNotification.create({
        data: {
          clientId: b.clientId,
          kind: "SYSTEM",
          title: "Coach account suspended",
          body: `A coach you work with on Match Fit was suspended pending review. Upcoming sessions were cancelled and eligible service amounts were refunded toward your card where Stripe allows (administrative and processing portions may be retained).`,
          linkHref: "/client/dashboard/messages",
        },
      });
    }
  }

  const convClients = await prisma.trainerClientConversation.findMany({
    where: { trainerId: args.trainerId, officialChatStartedAt: { not: null }, archivedAt: null },
    select: { clientId: true },
  });
  for (const c of convClients) {
    if (notifiedClients.has(c.clientId)) continue;
    notifiedClients.add(c.clientId);
    await prisma.clientNotification.create({
      data: {
        clientId: c.clientId,
        kind: "SYSTEM",
        title: "Coach account suspended",
        body: `A coach you are matched with on Match Fit was suspended pending review. You may be unable to schedule new sessions until their account is restored.`,
        linkHref: "/client/dashboard/messages",
      },
    });
  }

  return {
    bookingsCancelled: bookings.length,
    refundsAttempted,
    clientsNotified: notifiedClients.size,
  };
}

export async function suspendTrainerForGovernance(args: {
  trainerId: string;
  reasonCode: Exclude<TrainerSuspensionReasonCode, "CLIENT_REPORT">;
}): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    prisma.trainer.update({
      where: { id: args.trainerId },
      data: { safetySuspended: true, safetySuspendedAt: now },
    }),
    prisma.trainerNotification.create({
      data: {
        trainerId: args.trainerId,
        kind: "COMPLIANCE",
        title: "Account suspended — marketplace review",
        body:
          args.reasonCode === "PUNCH_STREAK"
            ? "Your account was suspended because five consecutive session start punch-ins were missed. Match Fit staff will review before reinstatement."
            : args.reasonCode === "DISPUTE_VOLUME"
              ? "Your account was suspended after three payout disputes were opened against your sessions in a rolling 30-day window. Staff will review."
              : "Your account was suspended pending Match Fit review.",
        linkHref: "/trainer/account-suspended",
      },
    }),
  ]);
  await applyTrainerMarketplaceSuspensionSideEffects({ trainerId: args.trainerId, reasonCode: args.reasonCode });
}

export async function notifyClientsTrainerSuspensionLifted(trainerId: string): Promise<number> {
  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { username: true, preferredName: true, firstName: true, lastName: true },
  });
  const label =
    trainer?.preferredName?.trim() ||
    [trainer?.firstName, trainer?.lastName].filter(Boolean).join(" ").trim() ||
    (trainer ? `@${trainer.username}` : "A coach");

  const convs = await prisma.trainerClientConversation.findMany({
    where: { trainerId, officialChatStartedAt: { not: null }, archivedAt: null },
    select: { clientId: true },
  });
  const unique = [...new Set(convs.map((c) => c.clientId))];
  for (const clientId of unique) {
    await prisma.clientNotification.create({
      data: {
        clientId,
        kind: "SYSTEM",
        title: "Coach account restored",
        body: `${label}'s Match Fit account was restored after review. You may resume coordinating sessions in Chats.`,
        linkHref: "/client/dashboard/messages",
      },
    });
  }
  return unique.length;
}
