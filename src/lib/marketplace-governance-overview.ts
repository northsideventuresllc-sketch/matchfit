import { loadCheckInSessionsForThread } from "@/lib/chat-check-in-thread-snapshot";
import type { CheckInSessionCard } from "@/lib/chat-check-in-thread-snapshot";
/** Import `prisma` from `lib/prisma` (singleton with dev self-heal; see `lib/prisma.ts`). */
import { prisma } from "@/lib/prisma";
import { isPrismaMissingTableError } from "@/lib/prisma-missing-column";
import { NON_REFUNDABLE_FEES_COPY } from "@/lib/session-check-in";
import { getConversationBookingSnapshot } from "@/lib/trainer-client-booking-credits";
import type { ManagementUpcomingBooking } from "@/lib/trainer-client-management-dashboard";
import { loadUpcomingBookingsByClientForTrainer } from "@/lib/trainer-client-management-dashboard";
import { listTrainerPunchInsLast60Days } from "@/lib/trainer-session-punch-in";

export type GovernanceBookingCredits = {
  sessionCreditsPurchased: number;
  sessionCreditsUsed: number;
  bookingUnlimitedAfterPurchase: boolean;
  creditsRemaining: number;
};

export type GovernanceAddonSummary = {
  totalUnitsFromLatestPurchase: number;
  consumedUnitsEstimated: number;
  remainingUnitsEstimated: number;
  perAddonUnitNetCents: number | null;
};

export type GovernanceDiyEngagement = {
  id: string;
  status: string;
  engagementStartedAt: string;
  firstDeliverByAt: string;
  firstDeliveredAt: string | null;
  trainerReceivableLoggedAt: string | null;
  clientReceivableAcknowledgedAt: string | null;
  cycleFundsReleaseNotBeforeAt: string | null;
  wallClockDeliverableDueAt: string | null;
  clientPostDueAttestation: string | null;
  extensionStatus: string | null;
  extensionHoursRequested: number | null;
  trainerUrgentUploadDeadlineAt: string | null;
  extensionClientDecisionByAt: string | null;
};

export type ClientCoachingGoalCard = {
  id: string;
  horizon: string;
  goalText: string;
  completionCriteria: string;
  completedAt: string | null;
};

export type ClientSessionSummaryCard = {
  id: string;
  occurredAt: string;
  body: string;
};

export type ClientCoachingProfileCard = {
  generalNotes: string;
  medicalInjuryNotes: string;
};

export type ClientUpcomingBookingRow = {
  bookingId: string;
  trainerUsername: string;
  trainerDisplayName: string;
  scheduledStartAt: string;
  scheduledEndAt: string | null;
  status: string;
  sessionDelivery: string | null;
  inviteNote: string | null;
  videoConferenceJoinUrl: string | null;
  confirmationDeadlineAt: string | null;
};

export type ClientPairGovernancePayload = {
  trainerId: string;
  trainerUsername: string;
  trainerDisplayName: string;
  blockFreeSessionBookingUntilRepurchase: boolean;
  /** Count of `BookedTrainingSession` rows in `INVITED` status (session booking invites awaiting the client). */
  pendingInviteCount: number;
  credits: GovernanceBookingCredits;
  addons: GovernanceAddonSummary | null;
  checkInSessions: CheckInSessionCard[];
  engagements: GovernanceDiyEngagement[];
  coachingGoals: ClientCoachingGoalCard[];
  coachingProfile: ClientCoachingProfileCard | null;
  sessionSummaries: ClientSessionSummaryCard[];
};

export type TrainerPunchHistoryRow = {
  id: string;
  punchedAt: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  sessionStartAt: string;
  clientUsername: string;
};

export type TrainerPairGovernancePayload = {
  clientId: string;
  clientUsername: string;
  clientDisplayName: string;
  conversationId: string | null;
  blockFreeSessionBookingUntilRepurchase: boolean;
  credits: GovernanceBookingCredits;
  addons: GovernanceAddonSummary | null;
  checkInSessions: CheckInSessionCard[];
  engagements: GovernanceDiyEngagement[];
  upcomingBookings: ManagementUpcomingBooking[];
};

async function countAddonAttributedSessions(trainerId: string, clientId: string): Promise<number> {
  return prisma.bookedTrainingSession.count({
    where: {
      trainerId,
      clientId,
      allocatedNetAddonCents: { gt: 0 },
      status: { not: "INVITED" },
    },
  });
}

async function addonSummaryForPair(trainerId: string, clientId: string): Promise<GovernanceAddonSummary | null> {
  const tx = await prisma.trainerClientServiceTransaction.findFirst({
    where: { trainerId, clientId },
    orderBy: { completedAt: "desc" },
    select: {
      ledgerTotalAddonUnits: true,
      ledgerPerAddonUnitNetCents: true,
      ledgerNetAddonPoolCents: true,
    },
  });
  if (!tx || (tx.ledgerNetAddonPoolCents ?? 0) <= 0 || (tx.ledgerTotalAddonUnits ?? 0) <= 0) {
    return null;
  }
  const total = Math.max(0, tx.ledgerTotalAddonUnits ?? 0);
  const consumed = Math.min(total, await countAddonAttributedSessions(trainerId, clientId));
  return {
    totalUnitsFromLatestPurchase: total,
    consumedUnitsEstimated: consumed,
    remainingUnitsEstimated: Math.max(0, total - consumed),
    perAddonUnitNetCents:
      tx.ledgerPerAddonUnitNetCents != null && tx.ledgerPerAddonUnitNetCents >= 0
        ? tx.ledgerPerAddonUnitNetCents
        : null,
  };
}

function displayTrainerName(row: {
  preferredName: string | null;
  firstName: string;
  lastName: string;
  username: string;
}): string {
  return (
    row.preferredName?.trim() ||
    [row.firstName, row.lastName].filter(Boolean).join(" ").trim() ||
    `@${row.username}`
  );
}

function displayClientName(row: {
  preferredName: string | null;
  firstName: string;
  lastName: string;
  username: string;
}): string {
  return (
    row.preferredName?.trim() ||
    [row.firstName, row.lastName].filter(Boolean).join(" ").trim() ||
    `@${row.username}`
  );
}

function serializeEngagement(r: {
  id: string;
  status: string;
  engagementStartedAt: Date;
  firstDeliverByAt: Date;
  firstDeliveredAt: Date | null;
  trainerReceivableLoggedAt: Date | null;
  clientReceivableAcknowledgedAt: Date | null;
  cycleFundsReleaseNotBeforeAt: Date | null;
  wallClockDeliverableDueAt: Date | null;
  clientPostDueAttestation: string | null;
  extensionStatus: string | null;
  extensionHoursRequested: number | null;
  trainerUrgentUploadDeadlineAt: Date | null;
  extensionClientDecisionByAt: Date | null;
}): GovernanceDiyEngagement {
  return {
    id: r.id,
    status: r.status,
    engagementStartedAt: r.engagementStartedAt.toISOString(),
    firstDeliverByAt: r.firstDeliverByAt.toISOString(),
    firstDeliveredAt: r.firstDeliveredAt?.toISOString() ?? null,
    trainerReceivableLoggedAt: r.trainerReceivableLoggedAt?.toISOString() ?? null,
    clientReceivableAcknowledgedAt: r.clientReceivableAcknowledgedAt?.toISOString() ?? null,
    cycleFundsReleaseNotBeforeAt: r.cycleFundsReleaseNotBeforeAt?.toISOString() ?? null,
    wallClockDeliverableDueAt: r.wallClockDeliverableDueAt?.toISOString() ?? null,
    clientPostDueAttestation: r.clientPostDueAttestation,
    extensionStatus: r.extensionStatus,
    extensionHoursRequested: r.extensionHoursRequested,
    trainerUrgentUploadDeadlineAt: r.trainerUrgentUploadDeadlineAt?.toISOString() ?? null,
    extensionClientDecisionByAt: r.extensionClientDecisionByAt?.toISOString() ?? null,
  };
}

const clientServiceMgmtConvSelect = {
  id: true,
  trainerId: true,
  blockFreeSessionBookingUntilRepurchase: true,
  trainer: {
    select: {
      username: true,
      preferredName: true,
      firstName: true,
      lastName: true,
    },
  },
} as const;

type ClientServiceMgmtConvRow = {
  id: string;
  trainerId: string;
  blockFreeSessionBookingUntilRepurchase: boolean;
  trainer: {
    username: string;
    preferredName: string | null;
    firstName: string;
    lastName: string;
  };
};

async function loadClientCoachingExtrasForTrainers(
  clientId: string,
  trainerIds: string[],
): Promise<{
  goalsByTrainer: Map<string, ClientCoachingGoalCard[]>;
  profilesByTrainer: Map<string, ClientCoachingProfileCard | null>;
  summariesByTrainer: Map<string, ClientSessionSummaryCard[]>;
}> {
  const goalsByTrainer = new Map<string, ClientCoachingGoalCard[]>();
  const profilesByTrainer = new Map<string, ClientCoachingProfileCard | null>();
  const summariesByTrainer = new Map<string, ClientSessionSummaryCard[]>();
  for (const tid of trainerIds) {
    goalsByTrainer.set(tid, []);
    profilesByTrainer.set(tid, null);
    summariesByTrainer.set(tid, []);
  }
  if (!trainerIds.length) {
    return { goalsByTrainer, profilesByTrainer, summariesByTrainer };
  }

  let allGoals: {
    id: string;
    trainerId: string;
    horizon: string;
    goalText: string;
    completionCriteria: string;
    completedAt: Date | null;
  }[] = [];
  try {
    allGoals = await prisma.trainerClientGoal.findMany({
      where: { clientId, trainerId: { in: trainerIds } },
      orderBy: { createdAt: "desc" },
      take: 400,
      select: {
        id: true,
        trainerId: true,
        horizon: true,
        goalText: true,
        completionCriteria: true,
        completedAt: true,
      },
    });
  } catch (e) {
    if (isPrismaMissingTableError(e, "trainer_client_goals")) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[loadClientServiceManagementPairs] trainer_client_goals missing; run `npx prisma migrate dev` or `db push`. Goals hidden until then.",
        );
      }
    } else {
      throw e;
    }
  }
  for (const g of allGoals) {
    const list = goalsByTrainer.get(g.trainerId);
    if (!list || list.length >= 50) continue;
    list.push({
      id: g.id,
      horizon: g.horizon,
      goalText: g.goalText,
      completionCriteria: g.completionCriteria,
      completedAt: g.completedAt?.toISOString() ?? null,
    });
  }

  try {
    const profiles = await prisma.trainerClientCoachingProfile.findMany({
      where: { clientId, trainerId: { in: trainerIds } },
      select: {
        trainerId: true,
        generalNotes: true,
        medicalInjuryNotes: true,
      },
    });
    for (const p of profiles) {
      const g = (p.generalNotes ?? "").trim();
      const m = (p.medicalInjuryNotes ?? "").trim();
      if (!g && !m) continue;
      profilesByTrainer.set(p.trainerId, { generalNotes: g, medicalInjuryNotes: m });
    }
  } catch (e) {
    if (!isPrismaMissingTableError(e, "trainer_client_coaching_profiles")) throw e;
    if (process.env.NODE_ENV !== "production") {
      console.warn("[loadClientServiceManagementPairs] trainer_client_coaching_profiles missing; coaching notes hidden.");
    }
  }

  try {
    const summariesRaw = await prisma.trainerClientSessionSummary.findMany({
      where: { clientId, trainerId: { in: trainerIds } },
      orderBy: { occurredAt: "desc" },
      take: 360,
      select: { id: true, trainerId: true, occurredAt: true, body: true },
    });
    for (const s of summariesRaw) {
      const list = summariesByTrainer.get(s.trainerId);
      if (!list || list.length >= 14) continue;
      list.push({
        id: s.id,
        occurredAt: s.occurredAt.toISOString(),
        body: s.body,
      });
    }
  } catch (e) {
    if (!isPrismaMissingTableError(e, "trainer_client_session_summaries")) throw e;
    if (process.env.NODE_ENV !== "production") {
      console.warn("[loadClientServiceManagementPairs] trainer_client_session_summaries missing; session notes hidden.");
    }
  }

  return { goalsByTrainer, profilesByTrainer, summariesByTrainer };
}

async function buildClientPairGovernancePayloads(
  clientId: string,
  convs: ClientServiceMgmtConvRow[],
  goalsByTrainer: Map<string, ClientCoachingGoalCard[]>,
  profilesByTrainer: Map<string, ClientCoachingProfileCard | null>,
  summariesByTrainer: Map<string, ClientSessionSummaryCard[]>,
): Promise<ClientPairGovernancePayload[]> {
  const pairs: ClientPairGovernancePayload[] = [];
  for (const c of convs) {
    const [creditsRaw, invites, engagements, snap] = await Promise.all([
      getConversationBookingSnapshot(c.trainerId, clientId),
      // Session booking invites awaiting client accept/decline (distinct from chat "threads").
      prisma.bookedTrainingSession.count({
        where: { trainerId: c.trainerId, clientId, status: "INVITED" },
      }),
      prisma.diyPlanEngagement.findMany({
        where: { trainerId: c.trainerId, clientId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          engagementStartedAt: true,
          firstDeliverByAt: true,
          firstDeliveredAt: true,
          trainerReceivableLoggedAt: true,
          clientReceivableAcknowledgedAt: true,
          cycleFundsReleaseNotBeforeAt: true,
          wallClockDeliverableDueAt: true,
          clientPostDueAttestation: true,
          extensionStatus: true,
          extensionHoursRequested: true,
          trainerUrgentUploadDeadlineAt: true,
          extensionClientDecisionByAt: true,
        },
      }),
      loadCheckInSessionsForThread({ trainerId: c.trainerId, clientId }).catch(() => ({
        feeDisclaimer: NON_REFUNDABLE_FEES_COPY,
        sessions: [] as CheckInSessionCard[],
      })),
    ]);

    pairs.push({
      trainerId: c.trainerId,
      trainerUsername: c.trainer.username,
      trainerDisplayName: displayTrainerName(c.trainer),
      blockFreeSessionBookingUntilRepurchase: c.blockFreeSessionBookingUntilRepurchase,
      pendingInviteCount: invites,
      credits: {
        sessionCreditsPurchased: creditsRaw.sessionCreditsPurchased,
        sessionCreditsUsed: creditsRaw.sessionCreditsUsed,
        bookingUnlimitedAfterPurchase: creditsRaw.bookingUnlimitedAfterPurchase,
        creditsRemaining: creditsRaw.bookingUnlimitedAfterPurchase ? 999 : creditsRaw.creditsRemaining,
      },
      addons: await addonSummaryForPair(c.trainerId, clientId),
      checkInSessions: snap.sessions,
      engagements: engagements.map(serializeEngagement),
      coachingGoals: goalsByTrainer.get(c.trainerId) ?? [],
      coachingProfile: profilesByTrainer.get(c.trainerId) ?? null,
      sessionSummaries: summariesByTrainer.get(c.trainerId) ?? [],
    });
  }
  return pairs;
}

export async function loadClientUpcomingBookingsForServiceManagement(clientId: string): Promise<ClientUpcomingBookingRow[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const rows = await prisma.bookedTrainingSession.findMany({
    where: {
      clientId,
      sessionClosedAt: null,
      scheduledStartAt: { gte: horizon },
      status: { in: ["INVITED", "CLIENT_CONFIRMED", "PENDING_CONFIRMATION"] },
    },
    orderBy: { scheduledStartAt: "asc" },
    take: 48,
    select: {
      id: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      status: true,
      sessionDelivery: true,
      inviteNote: true,
      videoConferenceJoinUrl: true,
      confirmationDeadlineAt: true,
      trainer: {
        select: {
          username: true,
          preferredName: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
  return rows.map((r) => ({
    bookingId: r.id,
    trainerUsername: r.trainer.username,
    trainerDisplayName: displayTrainerName(r.trainer),
    scheduledStartAt: r.scheduledStartAt.toISOString(),
    scheduledEndAt: r.scheduledEndAt?.toISOString() ?? null,
    status: r.status,
    sessionDelivery: r.sessionDelivery,
    inviteNote: r.inviteNote,
    videoConferenceJoinUrl: r.videoConferenceJoinUrl,
    confirmationDeadlineAt: r.confirmationDeadlineAt.toISOString(),
  }));
}

/** Active + archived official chats, upcoming bookings, and coaching artifacts for the client Service Management hub. */
export async function loadClientServiceManagementPairs(clientId: string): Promise<{
  feeDisclaimer: string;
  upcomingBookings: ClientUpcomingBookingRow[];
  activePairs: ClientPairGovernancePayload[];
  pastPairs: ClientPairGovernancePayload[];
}> {
  const [activeConvs, pastConvs] = await Promise.all([
    prisma.trainerClientConversation.findMany({
      where: {
        clientId,
        archivedAt: null,
        officialChatStartedAt: { not: null },
      },
      orderBy: { updatedAt: "desc" },
      select: clientServiceMgmtConvSelect,
    }),
    prisma.trainerClientConversation.findMany({
      where: {
        clientId,
        archivedAt: { not: null },
        officialChatStartedAt: { not: null },
      },
      orderBy: { archivedAt: "desc" },
      take: 40,
      select: clientServiceMgmtConvSelect,
    }),
  ]);

  const trainerIdSet = new Set<string>();
  for (const c of activeConvs) trainerIdSet.add(c.trainerId);
  for (const c of pastConvs) trainerIdSet.add(c.trainerId);
  const trainerIds = [...trainerIdSet];

  const extras = await loadClientCoachingExtrasForTrainers(clientId, trainerIds);

  const [activePairs, pastPairs, upcomingBookings] = await Promise.all([
    buildClientPairGovernancePayloads(
      clientId,
      activeConvs as ClientServiceMgmtConvRow[],
      extras.goalsByTrainer,
      extras.profilesByTrainer,
      extras.summariesByTrainer,
    ),
    buildClientPairGovernancePayloads(
      clientId,
      pastConvs as ClientServiceMgmtConvRow[],
      extras.goalsByTrainer,
      extras.profilesByTrainer,
      extras.summariesByTrainer,
    ),
    loadClientUpcomingBookingsForServiceManagement(clientId),
  ]);

  return { feeDisclaimer: NON_REFUNDABLE_FEES_COPY, upcomingBookings, activePairs, pastPairs };
}

export async function loadTrainerClientManagementPairs(trainerId: string): Promise<{
  feeDisclaimer: string;
  pairs: TrainerPairGovernancePayload[];
  punchHistory: TrainerPunchHistoryRow[];
}> {
  const punchRowsRaw = await listTrainerPunchInsLast60Days(trainerId);
  const punchHistory: TrainerPunchHistoryRow[] = punchRowsRaw.map((p) => ({
    id: p.id,
    punchedAt: p.createdAt.toISOString(),
    latitude: p.latitude,
    longitude: p.longitude,
    accuracyMeters: p.accuracyMeters,
    sessionStartAt: p.bookedTrainingSession.scheduledStartAt.toISOString(),
    clientUsername: p.bookedTrainingSession.client.username,
  }));

  const convs = await prisma.trainerClientConversation.findMany({
    where: {
      trainerId,
      archivedAt: null,
      officialChatStartedAt: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      clientId: true,
      blockFreeSessionBookingUntilRepurchase: true,
      client: {
        select: {
          username: true,
          preferredName: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  const clientIds = convs.map((c) => c.clientId);
  const upcomingMap = await loadUpcomingBookingsByClientForTrainer(trainerId, clientIds);

  const pairs: TrainerPairGovernancePayload[] = [];
  for (const c of convs) {
    const [creditsRaw, engagements, snap] = await Promise.all([
      getConversationBookingSnapshot(trainerId, c.clientId),
      prisma.diyPlanEngagement.findMany({
        where: { trainerId, clientId: c.clientId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          engagementStartedAt: true,
          firstDeliverByAt: true,
          firstDeliveredAt: true,
          trainerReceivableLoggedAt: true,
          clientReceivableAcknowledgedAt: true,
          cycleFundsReleaseNotBeforeAt: true,
          wallClockDeliverableDueAt: true,
          clientPostDueAttestation: true,
          extensionStatus: true,
          extensionHoursRequested: true,
          trainerUrgentUploadDeadlineAt: true,
          extensionClientDecisionByAt: true,
        },
      }),
      loadCheckInSessionsForThread({ trainerId, clientId: c.clientId }).catch(() => ({
        feeDisclaimer: NON_REFUNDABLE_FEES_COPY,
        sessions: [] as CheckInSessionCard[],
      })),
    ]);

    pairs.push({
      clientId: c.clientId,
      clientUsername: c.client.username,
      clientDisplayName: displayClientName(c.client),
      conversationId: c.id,
      blockFreeSessionBookingUntilRepurchase: c.blockFreeSessionBookingUntilRepurchase,
      credits: {
        sessionCreditsPurchased: creditsRaw.sessionCreditsPurchased,
        sessionCreditsUsed: creditsRaw.sessionCreditsUsed,
        bookingUnlimitedAfterPurchase: creditsRaw.bookingUnlimitedAfterPurchase,
        creditsRemaining: creditsRaw.bookingUnlimitedAfterPurchase ? 999 : creditsRaw.creditsRemaining,
      },
      addons: await addonSummaryForPair(trainerId, c.clientId),
      checkInSessions: snap.sessions,
      engagements: engagements.map(serializeEngagement),
      upcomingBookings: upcomingMap.get(c.clientId) ?? [],
    });
  }

  return { feeDisclaimer: NON_REFUNDABLE_FEES_COPY, pairs, punchHistory };
}

/** Narrow list for chat: invitations + virtual join URLs (optional trainer ledger rows). */
export async function loadChatScopedClientPendingBookings(
  trainerId: string,
  clientId: string,
  opts?: { trainerIncludePendingConfirmation?: boolean },
): Promise<
  {
    id: string;
    status: string;
    sessionDelivery: string | null;
    scheduledStartAt: Date;
    scheduledEndAt: Date | null;
    inviteNote: string | null;
    videoConferenceJoinUrl: string | null;
    videoConferenceProvider: string | null;
  }[]
> {
  const horizon = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const inviteStatuses = opts?.trainerIncludePendingConfirmation
    ? [{ status: "INVITED" as const }, { status: "PENDING_CONFIRMATION" as const }]
    : [{ status: "INVITED" as const }];
  return prisma.bookedTrainingSession.findMany({
    where: {
      trainerId,
      clientId,
      scheduledStartAt: { gte: horizon },
      OR: [
        ...inviteStatuses,
        {
          status: "CLIENT_CONFIRMED",
          sessionDelivery: "VIRTUAL",
          videoConferenceJoinUrl: { not: null },
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