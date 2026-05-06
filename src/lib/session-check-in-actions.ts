import { prisma } from "@/lib/prisma";
import { deadlineBeforeSession } from "@/lib/trainer-client-booking-service";
import {
  checkInWindowStartAt,
  deriveSessionClientUiPhase,
  FOREGO_PARTIAL_REFUND_NET_SLICE,
  gateAPostSessionDeadlineAt,
  payoutBufferEndsAtFromGates,
  refundCentsViaStripePaymentIntent,
  findServiceTransactionForStripeRefund,
} from "@/lib/session-check-in";
import type { GateSnapshot } from "@/lib/session-check-in";

async function appendSystemChat(args: { conversationId: string; body: string }): Promise<void> {
  await prisma.trainerClientChatMessage.create({
    data: { conversationId: args.conversationId, authorRole: "TRAINER", body: args.body },
  });
  await prisma.trainerClientConversation.update({
    where: { id: args.conversationId },
    data: { updatedAt: new Date() },
  });
}

function paymentIntentForBooking(booking: {
  attributionStripePaymentIntentId: string | null;
  trainerId: string;
  clientId: string;
}): Promise<string | null> {
  if (booking.attributionStripePaymentIntentId?.trim()) {
    return Promise.resolve(booking.attributionStripePaymentIntentId.trim());
  }
  return findServiceTransactionForStripeRefund({
    trainerId: booking.trainerId,
    clientId: booking.clientId,
  }).then((r) => r?.stripePaymentIntentId ?? null);
}

export function snapshotFromBookingRow(r: {
  status: string;
  fulfillmentStatus: string;
  scheduledStartAt: Date;
  scheduledEndAt: Date | null;
  gateASatisfiedAt: Date | null;
  gateARevokedBeforeStartAt: Date | null;
  trainerGateBCompletedAt: Date | null;
  payoutBufferEndsAt: Date | null;
  payoutFundsFrozen: boolean;
  disputeOpenedAt: Date | null;
}): GateSnapshot {
  return {
    status: r.status,
    fulfillmentStatus: r.fulfillmentStatus,
    scheduledStartAt: r.scheduledStartAt,
    scheduledEndAt: r.scheduledEndAt,
    gateASatisfiedAt: r.gateASatisfiedAt,
    gateARevokedBeforeStartAt: r.gateARevokedBeforeStartAt,
    trainerGateBCompletedAt: r.trainerGateBCompletedAt,
    payoutBufferEndsAt: r.payoutBufferEndsAt,
    payoutFundsFrozen: r.payoutFundsFrozen,
    disputeOpenedAt: r.disputeOpenedAt,
  };
}

/** Client positively closes Gate A (Confirm) — payout still requires trainer Gate B. */
export async function clientSatisfiesGateA(args: {
  bookingId: string;
  clientId: string;
}): Promise<{ ok: true } | { error: string }> {
  const row = await prisma.bookedTrainingSession.findFirst({
    where: { id: args.bookingId, clientId: args.clientId, status: "CLIENT_CONFIRMED" },
    select: {
      id: true,
      fulfillmentStatus: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      conversationId: true,
      gateASatisfiedAt: true,
      disputeOpenedAt: true,
      payoutFundsFrozen: true,
      payoutBufferEndsAt: true,
      trainerGateBCompletedAt: true,
      status: true,
      gateARevokedBeforeStartAt: true,
    },
  });
  if (!row) return { error: "Session not found or not eligible." };

  const phase = deriveSessionClientUiPhase(snapshotFromBookingRow(row));
  const allowed =
    phase === "gate_a_open_presession" ||
    phase === "gate_a_open_postsession" ||
    phase === "awaiting_followup";
  if (!allowed || row.gateASatisfiedAt) {
    return { error: "Gate A cannot be satisfied in the current phase." };
  }

  const now = new Date();
  await prisma.bookedTrainingSession.update({
    where: { id: row.id },
    data: {
      gateASatisfiedAt: now,
      gateASource: "CLIENT_CONFIRM",
      fulfillmentStatus: "WAITING_TRAINER_GATE_B",
      updatedAt: now,
    },
  });

  if (row.conversationId) {
    await appendSystemChat({
      conversationId: row.conversationId,
      body: `Match Fit: client confirmed Gate A for this session. The coach still must mark Gate B (“session completed”) before funds move toward payout, then the 48-hour dispute buffer runs.`,
    });
  }

  return { ok: true };
}

/** Client revoke before scheduled start — cancels booked session slot. */
export async function clientRevokesGateAPreSession(args: {
  bookingId: string;
  clientId: string;
}): Promise<{ ok: true } | { error: string }> {
  const row = await prisma.bookedTrainingSession.findFirst({
    where: { id: args.bookingId, clientId: args.clientId, status: "CLIENT_CONFIRMED" },
    select: {
      id: true,
      trainerId: true,
      clientId: true,
      scheduledStartAt: true,
      conversationId: true,
      fulfillmentStatus: true,
      allocatedCoachServiceCents: true,
      allocatedNetAddonCents: true,
      attributionStripePaymentIntentId: true,
      gateASatisfiedAt: true,
      gateARevokedBeforeStartAt: true,
    },
  });
  if (!row) return { error: "Session not found." };
  if (Date.now() >= row.scheduledStartAt.getTime()) {
    return { error: "Revoke is disabled after the session starts." };
  }
  if (row.gateASatisfiedAt || row.gateARevokedBeforeStartAt) {
    return { error: "Gate A already closed." };
  }

  const refundCents = Math.max(0, row.allocatedCoachServiceCents + row.allocatedNetAddonCents);
  const piId = await paymentIntentForBooking(row);
  let refundId: string | null = null;
  if (refundCents > 0 && piId) {
    const res = await refundCentsViaStripePaymentIntent({
      paymentIntentId: piId,
      amountCents: refundCents,
      idempotencyKey: `gate-a-revoke:${row.id}`,
    });
    if ("error" in res) return { error: `Refund failed: ${res.error}` };
    refundId = res.refundId;
  }

  const conv = row.conversationId
    ? await prisma.trainerClientConversation.findUnique({
        where: { id: row.conversationId },
        select: { bookingUnlimitedAfterPurchase: true },
      })
    : null;

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.bookedTrainingSession.update({
      where: { id: row.id },
      data: {
        status: "CANCELLED",
        fulfillmentStatus: "CANCELLED_CLIENT_REVOKE_GATE_A",
        gateARevokedBeforeStartAt: now,
        sessionClosedAt: now,
        lastStripeRefundId: refundId,
        lastStripeRefundCents: refundCents,
        updatedAt: now,
      },
    });
    if (row.conversationId && !conv?.bookingUnlimitedAfterPurchase) {
      const cur = await tx.trainerClientConversation.findUnique({
        where: { id: row.conversationId },
        select: { sessionCreditsUsed: true },
      });
      if (cur && cur.sessionCreditsUsed > 0) {
        await tx.trainerClientConversation.update({
          where: { id: row.conversationId },
          data: { sessionCreditsUsed: { decrement: 1 }, updatedAt: now },
        });
      }
    }
  });

  if (row.conversationId) {
    await appendSystemChat({
      conversationId: row.conversationId,
      body: `Match Fit: client revoked before the scheduled start time. Session cancelled — net pooled amount refunded where eligible (${(refundCents / 100).toFixed(2)} USD toward card). Fees remain non-refundable per Terms.`,
    });
  }

  return { ok: true };
}

export async function trainerCompletesGateB(args: {
  bookingId: string;
  trainerId: string;
}): Promise<{ ok: true } | { error: string }> {
  const row = await prisma.bookedTrainingSession.findFirst({
    where: { id: args.bookingId, trainerId: args.trainerId, status: "CLIENT_CONFIRMED" },
    select: {
      id: true,
      gateASatisfiedAt: true,
      trainerGateBCompletedAt: true,
      conversationId: true,
    },
  });
  if (!row?.gateASatisfiedAt) return { error: "Client Gate A must be satisfied first." };
  if (row.trainerGateBCompletedAt) return { error: "Already marked complete." };

  const now = new Date();
  const payoutBufferEndsAt = payoutBufferEndsAtFromGates({
    gateASatisfiedAt: row.gateASatisfiedAt,
    trainerGateBCompletedAt: now,
  });

  await prisma.bookedTrainingSession.update({
    where: { id: row.id },
    data: {
      trainerGateBCompletedAt: now,
      payoutBufferEndsAt,
      fulfillmentStatus: "GATES_IN_PAYOUT_BUFFER",
      updatedAt: now,
    },
  });

  if (row.conversationId) {
    await appendSystemChat({
      conversationId: row.conversationId,
      body: `Match Fit: coach closed Gate B. The 48-hour client dispute buffer is now counting down. Funds stay frozen if a dispute is filed during this window.`,
    });
  }

  return { ok: true };
}

export async function markSessionNotCompleteByClient(args: {
  bookingId: string;
  clientId: string;
}): Promise<{ ok: true } | { error: string }> {
  const row = await prisma.bookedTrainingSession.findFirst({
    where: { id: args.bookingId, clientId: args.clientId, status: "CLIENT_CONFIRMED" },
    select: {
      id: true,
      fulfillmentStatus: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      conversationId: true,
      gateASatisfiedAt: true,
      disputeOpenedAt: true,
      payoutFundsFrozen: true,
      payoutBufferEndsAt: true,
      trainerGateBCompletedAt: true,
      status: true,
      gateARevokedBeforeStartAt: true,
    },
  });
  if (!row) return { error: "Session not found or not eligible." };
  const phase = deriveSessionClientUiPhase(snapshotFromBookingRow(row));
  if (phase !== "gate_a_open_postsession") {
    return { error: "You can flag an issue once the scheduled session window has begun." };
  }

  const now = new Date();
  await prisma.bookedTrainingSession.update({
    where: { id: row.id },
    data: {
      fulfillmentStatus: "AWAITING_CLIENT_FOLLOWUP",
      markedNotCompleteAt: now,
      updatedAt: now,
    },
  });

  if (row.conversationId) {
    await appendSystemChat({
      conversationId: row.conversationId,
      body: `Match Fit: the client reported the session outcome is unresolved. They can reschedule or forego according to ledger rules.`,
    });
  }

  return { ok: true };
}

export async function clientForegoSessionWithPartialRefund(args: {
  bookingId: string;
  clientId: string;
}): Promise<{ ok: true; refundCents: number } | { error: string }> {
  const row = await prisma.bookedTrainingSession.findFirst({
    where: { id: args.bookingId, clientId: args.clientId, status: "CLIENT_CONFIRMED" },
    select: {
      id: true,
      fulfillmentStatus: true,
      trainerId: true,
      clientId: true,
      allocatedCoachServiceCents: true,
      allocatedNetAddonCents: true,
      attributionStripePaymentIntentId: true,
      conversationId: true,
      gateASatisfiedAt: true,
      trainerGateBCompletedAt: true,
    },
  });
  if (!row) return { error: "Session not found." };
  if (row.fulfillmentStatus !== "AWAITING_CLIENT_FOLLOWUP") {
    return { error: "Forego is only available after you indicate the session outcome is unresolved." };
  }

  const netSlice = Math.max(0, row.allocatedCoachServiceCents + row.allocatedNetAddonCents);
  const refundCents = Math.floor(netSlice * FOREGO_PARTIAL_REFUND_NET_SLICE);

  const piId = await paymentIntentForBooking(row);
  let refundId: string | null = null;
  if (refundCents > 0 && piId) {
    const res = await refundCentsViaStripePaymentIntent({
      paymentIntentId: piId,
      amountCents: refundCents,
      idempotencyKey: `forego:${row.id}`,
    });
    if ("error" in res) {
      return {
        error: `Refund could not be completed (${res.error}). Contact Match Fit support with your session id.`,
      };
    }
    refundId = res.refundId;
  }

  const now = new Date();
  await prisma.bookedTrainingSession.update({
    where: { id: row.id },
    data: {
      status: "CANCELLED",
      fulfillmentStatus: "CANCELLED_FOREGONE",
      sessionClosedAt: now,
      lastStripeRefundId: refundId,
      lastStripeRefundCents: refundCents,
      updatedAt: now,
    },
  });

  if (row.conversationId) {
    await appendSystemChat({
      conversationId: row.conversationId,
      body: `Match Fit: client forewent the session. Partial refund (${(refundCents / 100).toFixed(2)} USD) of net ledger slice applied where Stripe allows; administrative & processing portions stay non-refundable.`,
    });
  }

  return { ok: true, refundCents };
}

export async function createSessionPayoutDispute(args: {
  bookingId: string;
  clientId: string;
  wasRescheduled: boolean;
  wasCancelled: boolean;
  reasonDetail: string;
}): Promise<{ ok: true; disputeId: string } | { error: string }> {
  const row = await prisma.bookedTrainingSession.findFirst({
    where: { id: args.bookingId, clientId: args.clientId, status: "CLIENT_CONFIRMED" },
    select: {
      id: true,
      conversationId: true,
      payoutBufferEndsAt: true,
      gateASatisfiedAt: true,
      trainerGateBCompletedAt: true,
      payoutFundsFrozen: true,
    },
  });
  if (!row?.gateASatisfiedAt || !row.trainerGateBCompletedAt || !row.payoutBufferEndsAt) {
    return {
      error: "Dispute can only be opened during the 48-hour payout buffer after coach and client gates are satisfied.",
    };
  }
  if (Date.now() >= row.payoutBufferEndsAt.getTime()) return { error: "The dispute buffer has expired." };

  const now = new Date();
  const d = await prisma.sessionPayoutDispute.create({
    data: {
      bookedTrainingSessionId: row.id,
      clientId: args.clientId,
      answeredWasRescheduled: args.wasRescheduled,
      answeredWasCancelled: args.wasCancelled,
      answeredReasonDetail: args.reasonDetail.trim().slice(0, 8000),
      status: "PENDING_ADMIN",
    },
    select: { id: true },
  });

  await prisma.bookedTrainingSession.update({
    where: { id: row.id },
    data: {
      payoutFundsFrozen: true,
      disputeOpenedAt: now,
      fulfillmentStatus: "PAYOUT_DISPUTE_FROZEN",
      updatedAt: now,
    },
  });

  if (row.conversationId) {
    await appendSystemChat({
      conversationId: row.conversationId,
      body: `Match Fit: client opened a payout dispute during the buffer window. Funds are frozen until staff review the answers on file.`,
    });
  }

  return { ok: true, disputeId: d.id };
}

export async function createRescheduleProposal(args: {
  bookingId: string;
  actorIsTrainer: boolean;
  trainerId: string;
  clientId: string;
  proposedStartAt: Date;
  proposedEndAt: Date;
  note?: string | null;
}): Promise<{ ok: true; requestId: string } | { error: string }> {
  if (args.proposedEndAt.getTime() <= args.proposedStartAt.getTime()) {
    return { error: "End time must be after start time." };
  }

  const booking = await prisma.bookedTrainingSession.findFirst({
    where: {
      id: args.bookingId,
      trainerId: args.trainerId,
      clientId: args.clientId,
      status: "CLIENT_CONFIRMED",
    },
    select: {
      id: true,
      fulfillmentStatus: true,
      conversationId: true,
      gateASatisfiedAt: true,
      trainerGateBCompletedAt: true,
    },
  });
  if (!booking?.conversationId) return { error: "Session not found." };

  if (booking.gateASatisfiedAt || booking.trainerGateBCompletedAt) {
    return { error: "Reschedule proposals are locked after payout gates advance." };
  }

  const allowedFulfillment = new Set(["SCHEDULED", "CHECK_IN_ACTIVE", "AWAITING_CLIENT_FOLLOWUP"]);
  if (!allowedFulfillment.has(booking.fulfillmentStatus)) {
    return { error: "This session cannot be rescheduled anymore." };
  }

  const pending = await prisma.sessionRescheduleRequest.count({
    where: { bookedTrainingSessionId: booking.id, status: "PENDING" },
  });
  if (pending > 0) return { error: "A reschedule request is already pending for this session." };

  const req = await prisma.sessionRescheduleRequest.create({
    data: {
      bookedTrainingSessionId: booking.id,
      requestedByTrainer: args.actorIsTrainer,
      proposedStartAt: args.proposedStartAt,
      proposedEndAt: args.proposedEndAt,
      note: args.note?.trim() || null,
      status: "PENDING",
    },
    select: { id: true },
  });

  const who = args.actorIsTrainer ? "Your coach" : "The client";
  await appendSystemChat({
    conversationId: booking.conversationId,
    body: `Match Fit reschedule: ${who} proposed a new time (${args.proposedStartAt.toLocaleString()} – ${args.proposedEndAt.toLocaleTimeString()}). Open session actions to accept or decline.`,
  });

  return { ok: true, requestId: req.id };
}

export async function respondToRescheduleRequest(args: {
  requestId: string;
  actorIsTrainer: boolean;
  trainerId: string;
  clientId: string;
  accept: boolean;
}): Promise<{ ok: true } | { error: string }> {
  const req = await prisma.sessionRescheduleRequest.findFirst({
    where: { id: args.requestId, status: "PENDING" },
    include: {
      bookedTrainingSession: {
        select: {
          id: true,
          trainerId: true,
          clientId: true,
          status: true,
          fulfillmentStatus: true,
          conversationId: true,
          allocatedCoachServiceCents: true,
          allocatedNetAddonCents: true,
          attributionStripePaymentIntentId: true,
          scheduledStartAt: true,
        },
      },
    },
  });
  if (!req) return { error: "Request not found." };
  const b = req.bookedTrainingSession;
  if (b.trainerId !== args.trainerId || b.clientId !== args.clientId) return { error: "Not allowed." };

  const counterpartyIsTrainer = !req.requestedByTrainer;
  if (args.actorIsTrainer !== counterpartyIsTrainer) {
    return { error: "Only the other party can respond to this reschedule." };
  }
  if (!b.conversationId) return { error: "Missing conversation." };

  const conv = await prisma.trainerClientConversation.findUnique({
    where: { id: b.conversationId },
    select: { bookingUnlimitedAfterPurchase: true },
  });

  if (args.accept) {
    await prisma.$transaction([
      prisma.sessionRescheduleRequest.update({
        where: { id: req.id },
        data: { status: "ACCEPTED", updatedAt: new Date() },
      }),
      prisma.bookedTrainingSession.update({
        where: { id: b.id },
        data: {
          scheduledStartAt: req.proposedStartAt,
          scheduledEndAt: req.proposedEndAt,
          fulfillmentStatus: "SCHEDULED",
          gateASatisfiedAt: null,
          gateASource: null,
          gateARevokedBeforeStartAt: null,
          trainerGateBCompletedAt: null,
          payoutBufferEndsAt: null,
          payoutFundsFrozen: false,
          disputeOpenedAt: null,
          markedNotCompleteAt: null,
          confirmationDeadlineAt: deadlineBeforeSession(req.proposedStartAt),
          updatedAt: new Date(),
        },
      }),
    ]);
    await appendSystemChat({
      conversationId: b.conversationId,
      body: `Match Fit: reschedule accepted. Gates reset — new times are locked in.`,
    });
    return { ok: true };
  }

  const refundTrainerLed = req.requestedByTrainer;
  const refundCents = refundTrainerLed
    ? Math.max(0, b.allocatedCoachServiceCents + b.allocatedNetAddonCents)
    : 0;
  const piId = await paymentIntentForBooking({
    attributionStripePaymentIntentId: b.attributionStripePaymentIntentId,
    trainerId: b.trainerId,
    clientId: b.clientId,
  });

  let refundId: string | null = null;
  if (refundCents > 0 && piId) {
    const res = await refundCentsViaStripePaymentIntent({
      paymentIntentId: piId,
      amountCents: refundCents,
      idempotencyKey: `resched-decline-client:${req.id}`,
    });
    if ("error" in res) return { error: `Refund could not be completed (${res.error}).` };
    refundId = res.refundId;
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.sessionRescheduleRequest.update({
      where: { id: req.id },
      data: { status: "DECLINED", updatedAt: now },
    });
    await tx.bookedTrainingSession.update({
      where: { id: b.id },
      data: {
        status: "CANCELLED",
        fulfillmentStatus: refundTrainerLed
          ? "CANCELLED_RESCHED_DECLINED_BY_CLIENT"
          : "CANCELLED_RESCHED_DECLINED_BY_TRAINER",
        sessionClosedAt: now,
        lastStripeRefundId: refundId,
        lastStripeRefundCents: refundCents,
        updatedAt: now,
      },
    });

    if (refundTrainerLed && b.conversationId && !conv?.bookingUnlimitedAfterPurchase) {
      const cur = await tx.trainerClientConversation.findUnique({
        where: { id: b.conversationId },
        select: { sessionCreditsUsed: true },
      });
      if (cur && cur.sessionCreditsUsed > 0) {
        await tx.trainerClientConversation.update({
          where: { id: b.conversationId },
          data: { sessionCreditsUsed: { decrement: 1 }, updatedAt: now },
        });
      }
    }

    if (!refundTrainerLed && b.conversationId) {
      await tx.trainerClientConversation.update({
        where: { id: b.conversationId },
        data: { blockFreeSessionBookingUntilRepurchase: true, updatedAt: now },
      });
    }
  });

  await appendSystemChat({
    conversationId: b.conversationId,
    body: refundTrainerLed
      ? `Match Fit: client declined coach-led reschedule — session cancelled with full NET service+add-on refund toward card where eligible; credits restored when applicable (fees retained).`
      : `Match Fit: coach declined client-led reschedule — late cancellation protections apply (no payout refund to card; trainer side accrues per ledger). Purchase again before new bookings.`,
  });

  return { ok: true };
}

export async function withdrawRescheduleRequest(args: {
  requestId: string;
  actorIsTrainer: boolean;
  trainerId: string;
  clientId: string;
}): Promise<{ ok: true } | { error: string }> {
  const req = await prisma.sessionRescheduleRequest.findFirst({
    where: { id: args.requestId, status: "PENDING" },
    include: {
      bookedTrainingSession: { select: { trainerId: true, clientId: true, conversationId: true } },
    },
  });
  if (!req) return { error: "Request not found." };
  if (req.bookedTrainingSession.trainerId !== args.trainerId || req.bookedTrainingSession.clientId !== args.clientId) {
    return { error: "Not allowed." };
  }
  if (req.requestedByTrainer !== args.actorIsTrainer) {
    return { error: "Only the requester can withdraw." };
  }
  await prisma.sessionRescheduleRequest.update({
    where: { id: req.id },
    data: { status: "WITHDRAWN", updatedAt: new Date() },
  });
  if (req.bookedTrainingSession.conversationId) {
    await appendSystemChat({
      conversationId: req.bookedTrainingSession.conversationId,
      body: "Match Fit: reschedule request withdrawn.",
    });
  }
  return { ok: true };
}

/** Auto-close Gate A if client silent through post-session window (no revoke / unresolved flag). */
export async function autoSatisfyGateASilenceCron(now = new Date()): Promise<number> {
  const rows = await prisma.bookedTrainingSession.findMany({
    where: {
      status: "CLIENT_CONFIRMED",
      gateASatisfiedAt: null,
      gateARevokedBeforeStartAt: null,
      disputeOpenedAt: null,
      fulfillmentStatus: { in: ["SCHEDULED", "CHECK_IN_ACTIVE"] },
    },
    select: {
      id: true,
      conversationId: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      fulfillmentStatus: true,
    },
  });
  let n = 0;
  for (const r of rows) {
    const deadline = gateAPostSessionDeadlineAt({
      scheduledStartAt: r.scheduledStartAt,
      scheduledEndAt: r.scheduledEndAt,
    });
    if (now.getTime() < deadline.getTime()) continue;
    if (r.fulfillmentStatus === "AWAITING_CLIENT_FOLLOWUP") continue;

    await prisma.bookedTrainingSession.update({
      where: { id: r.id },
      data: {
        gateASatisfiedAt: now,
        gateASource: "AUTO_SILENCE",
        fulfillmentStatus: "WAITING_TRAINER_GATE_B",
        updatedAt: now,
      },
    });
    n += 1;
    if (r.conversationId) {
      await appendSystemChat({
        conversationId: r.conversationId,
        body: `Match Fit: Gate A auto-confirmed — no client objection before the cutoff after the booked session.`,
      });
    }
  }
  return n;
}

/** Backfills payout buffers if both timestamps exist but buffer missing. */
export async function reconcilePayoutBufferDates(now = new Date()): Promise<number> {
  const rows = await prisma.bookedTrainingSession.findMany({
    where: {
      status: "CLIENT_CONFIRMED",
      gateASatisfiedAt: { not: null },
      trainerGateBCompletedAt: { not: null },
      payoutBufferEndsAt: null,
    },
    select: { id: true, gateASatisfiedAt: true, trainerGateBCompletedAt: true },
  });
  let n = 0;
  for (const r of rows) {
    if (!r.gateASatisfiedAt || !r.trainerGateBCompletedAt) continue;
    const payoutBufferEndsAt = payoutBufferEndsAtFromGates({
      gateASatisfiedAt: r.gateASatisfiedAt,
      trainerGateBCompletedAt: r.trainerGateBCompletedAt,
    });
    await prisma.bookedTrainingSession.update({
      where: { id: r.id },
      data: {
        payoutBufferEndsAt,
        fulfillmentStatus: "GATES_IN_PAYOUT_BUFFER",
        updatedAt: now,
      },
    });
    n += 1;
  }
  return n;
}

export async function settleSessionsPastPayoutBuffer(now = new Date()): Promise<number> {
  const rows = await prisma.bookedTrainingSession.findMany({
    where: {
      status: "CLIENT_CONFIRMED",
      payoutBufferEndsAt: { not: null, lt: now },
      payoutFundsFrozen: false,
      disputeOpenedAt: null,
      fulfillmentStatus: "GATES_IN_PAYOUT_BUFFER",
    },
    select: { id: true, conversationId: true },
  });
  let n = 0;
  for (const r of rows) {
    await prisma.bookedTrainingSession.update({
      where: { id: r.id },
      data: {
        fulfillmentStatus: "SESSION_PAYMENT_ROUTE_CLEARED",
        sessionClosedAt: now,
        updatedAt: now,
      },
    });
    n += 1;
    if (r.conversationId) {
      await appendSystemChat({
        conversationId: r.conversationId,
        body: `Match Fit: payout buffer expired without a dispute freeze. Ledger payout may proceed outbound per payout ops (subject to connected accounts / treasury).`,
      });
    }
  }
  return n;
}

/** Legacy flag flip for UI performance (still used by cron). */
export async function syncCheckInActiveFlags(now = new Date()): Promise<number> {
  const rows = await prisma.bookedTrainingSession.findMany({
    where: {
      status: "CLIENT_CONFIRMED",
      fulfillmentStatus: "SCHEDULED",
      gateASatisfiedAt: null,
    },
    select: { id: true, scheduledStartAt: true },
  });
  let n = 0;
  for (const r of rows) {
    const start = checkInWindowStartAt(r.scheduledStartAt);
    if (now.getTime() >= start.getTime()) {
      await prisma.bookedTrainingSession.update({
        where: { id: r.id },
        data: { fulfillmentStatus: "CHECK_IN_ACTIVE", updatedAt: now },
      });
      n += 1;
    }
  }
  return n;
}
