import { prisma } from "@/lib/prisma";
import type { GateSnapshot } from "@/lib/session-check-in-timing";
import { deriveCheckInUiPhase } from "@/lib/session-check-in-timing";
import { NON_REFUNDABLE_FEES_COPY } from "@/lib/session-check-in";

export type CheckInSessionCard = {
  bookingId: string;
  startsAt: string;
  endsAt: string | null;
  fulfillmentStatus: string;
  payoutBufferEndsAt: string | null;
  gateASatisfiedAt: string | null;
  trainerGateBCompletedAt: string | null;
  /** True when coach recorded SESSION STARTED with geolocation for this booking. */
  hasTrainerPunchIn: boolean;
  uiPhase: ReturnType<typeof deriveCheckInUiPhase>;
  /** Net service slice + net add-on slice attributed to this session (after platform + estimated processing fees). */
  coachPortionCents: number;
  addonPortionCents: number;
  pendingReschedule: {
    id: string;
    requestedByTrainer: boolean;
    proposedStartAt: string;
    proposedEndAt: string;
    note: string | null;
  } | null;
};

function cardSnapshot(row: {
  scheduledStartAt: Date;
  scheduledEndAt: Date | null;
  fulfillmentStatus: string;
  gateASatisfiedAt: Date | null;
  gateARevokedBeforeStartAt: Date | null;
  trainerGateBCompletedAt: Date | null;
  payoutBufferEndsAt: Date | null;
  payoutFundsFrozen: boolean;
  disputeOpenedAt: Date | null;
}): GateSnapshot {
  return {
    status: "CLIENT_CONFIRMED",
    fulfillmentStatus: row.fulfillmentStatus,
    scheduledStartAt: row.scheduledStartAt,
    scheduledEndAt: row.scheduledEndAt,
    gateASatisfiedAt: row.gateASatisfiedAt,
    gateARevokedBeforeStartAt: row.gateARevokedBeforeStartAt,
    trainerGateBCompletedAt: row.trainerGateBCompletedAt,
    payoutBufferEndsAt: row.payoutBufferEndsAt,
    payoutFundsFrozen: row.payoutFundsFrozen,
    disputeOpenedAt: row.disputeOpenedAt,
  };
}

export async function loadCheckInSessionsForThread(args: {
  trainerId: string;
  clientId: string;
}): Promise<{ feeDisclaimer: string; sessions: CheckInSessionCard[] }> {
  const where = {
    trainerId: args.trainerId,
    clientId: args.clientId,
    status: "CLIENT_CONFIRMED" as const,
    sessionClosedAt: null,
  };
  const orderBy = { scheduledStartAt: "asc" as const };
  const take = 16;
  const rows = await prisma.bookedTrainingSession.findMany({
    where,
    orderBy,
    take,
    select: {
      id: true,
      fulfillmentStatus: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      allocatedCoachServiceCents: true,
      allocatedNetAddonCents: true,
      gateASatisfiedAt: true,
      gateARevokedBeforeStartAt: true,
      trainerGateBCompletedAt: true,
      payoutBufferEndsAt: true,
      payoutFundsFrozen: true,
      disputeOpenedAt: true,
      punchIns: { select: { id: true }, take: 1 },
      rescheduleRequests: {
        where: { status: "PENDING" as const },
        take: 1,
        select: {
          id: true,
          requestedByTrainer: true,
          proposedStartAt: true,
          proposedEndAt: true,
          note: true,
        },
      },
    },
  });

  const sessions: CheckInSessionCard[] = rows.map((r) => {
    const pending = r.rescheduleRequests[0] ?? null;
    const snap = cardSnapshot(r);
    return {
      bookingId: r.id,
      startsAt: r.scheduledStartAt.toISOString(),
      endsAt: r.scheduledEndAt?.toISOString() ?? null,
      fulfillmentStatus: r.fulfillmentStatus,
      payoutBufferEndsAt: r.payoutBufferEndsAt?.toISOString() ?? null,
      gateASatisfiedAt: r.gateASatisfiedAt?.toISOString() ?? null,
      trainerGateBCompletedAt: r.trainerGateBCompletedAt?.toISOString() ?? null,
      hasTrainerPunchIn: (r.punchIns?.length ?? 0) > 0,
      uiPhase: deriveCheckInUiPhase(snap),
      coachPortionCents: Math.max(0, r.allocatedCoachServiceCents),
      addonPortionCents: Math.max(0, r.allocatedNetAddonCents),
      pendingReschedule: pending
        ? {
            id: pending.id,
            requestedByTrainer: pending.requestedByTrainer,
            proposedStartAt: pending.proposedStartAt.toISOString(),
            proposedEndAt: pending.proposedEndAt.toISOString(),
            note: pending.note,
          }
        : null,
    };
  });

  return { feeDisclaimer: NON_REFUNDABLE_FEES_COPY, sessions };
}
