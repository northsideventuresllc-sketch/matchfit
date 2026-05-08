import { prisma } from "@/lib/prisma";

export type DiyEngagementDto = {
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
}): DiyEngagementDto {
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

export type CoachingGoalDto = {
  id: string;
  horizon: string;
  goalText: string;
  completionCriteria: string;
  completedAt: string | null;
};

export type SessionSummaryDto = {
  id: string;
  occurredAt: string;
  body: string;
  emailedAt: string | null;
};

export async function loadTrainerClientCoachingBundle(trainerId: string, clientId: string) {
  const [profile, goals, summaries, engagements, clientEmail] = await Promise.all([
    prisma.trainerClientCoachingProfile.findUnique({
      where: { trainerId_clientId: { trainerId, clientId } },
    }),
    prisma.trainerClientGoal.findMany({
      where: { trainerId, clientId },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    prisma.trainerClientSessionSummary.findMany({
      where: { trainerId, clientId },
      orderBy: { occurredAt: "desc" },
      take: 60,
    }),
    prisma.diyPlanEngagement.findMany({
      where: { trainerId, clientId },
      orderBy: { createdAt: "desc" },
      take: 3,
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
    prisma.client.findUnique({
      where: { id: clientId },
      select: { email: true },
    }),
  ]);

  const hasDiy = engagements.length > 0;
  return {
    profile: profile
      ? {
          generalNotes: profile.generalNotes ?? "",
          medicalInjuryNotes: profile.medicalInjuryNotes ?? "",
        }
      : { generalNotes: "", medicalInjuryNotes: "" },
    goals: goals.map(
      (g): CoachingGoalDto => ({
        id: g.id,
        horizon: g.horizon,
        goalText: g.goalText,
        completionCriteria: g.completionCriteria,
        completedAt: g.completedAt?.toISOString() ?? null,
      }),
    ),
    sessionSummaries: summaries.map(
      (s): SessionSummaryDto => ({
        id: s.id,
        occurredAt: s.occurredAt.toISOString(),
        body: s.body,
        emailedAt: s.emailedAt?.toISOString() ?? null,
      }),
    ),
    diyEngagements: engagements.map(serializeEngagement),
    hasDiy,
    clientEmailMasked: clientEmail?.email ? true : false,
  };
}

export async function loadClientVisibleGoalsForTrainer(clientId: string, trainerId: string): Promise<CoachingGoalDto[]> {
  const goals = await prisma.trainerClientGoal.findMany({
    where: { trainerId, clientId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return goals.map((g) => ({
    id: g.id,
    horizon: g.horizon,
    goalText: g.goalText,
    completionCriteria: g.completionCriteria,
    completedAt: g.completedAt?.toISOString() ?? null,
  }));
}
