import { prisma } from "@/lib/prisma";
import {
  backgroundCheckExpiresAt,
  shouldSendBackgroundCheckExpiryWarning,
} from "@/lib/trainer-background-check-renewal";

export type TosCronSummary = {
  backgroundCheckWarningsSent: number;
  backgroundCheckSuspensions: number;
  backgroundCheckClearedBackfill: number;
  sessionsAutoCompleted: number;
  diyRefundAlerts: number;
};

async function backfillApprovedBackgroundCheckTimestamps(): Promise<number> {
  const now = new Date();
  const res = await prisma.trainerProfile.updateMany({
    where: {
      backgroundCheckStatus: "APPROVED",
      backgroundCheckClearedAt: null,
    },
    data: { backgroundCheckClearedAt: now },
  });
  return res.count;
}

async function processBackgroundCheckRenewals(): Promise<{ warnings: number; suspensions: number }> {
  let warnings = 0;
  let suspensions = 0;
  const profiles = await prisma.trainerProfile.findMany({
    where: { backgroundCheckStatus: "APPROVED", backgroundCheckClearedAt: { not: null } },
    select: {
      trainerId: true,
      backgroundCheckClearedAt: true,
      backgroundCheckExpiryWarningSentAt: true,
      trainer: { select: { safetySuspended: true } },
    },
  });

  for (const p of profiles) {
    const cleared = p.backgroundCheckClearedAt!;
    if (p.trainer.safetySuspended) continue;

    if (Date.now() >= backgroundCheckExpiresAt(cleared).getTime()) {
      await prisma.$transaction([
        prisma.trainer.update({
          where: { id: p.trainerId },
          data: { safetySuspended: true, safetySuspendedAt: new Date() },
        }),
        prisma.trainerNotification.create({
          data: {
            trainerId: p.trainerId,
            kind: "COMPLIANCE",
            title: "Background check renewal required",
            body: "Your background screening has reached its 12-month renewal date. Your account is suspended until you complete a new check.",
            linkHref: "/trainer/dashboard/compliance",
          },
        }),
      ]);
      suspensions += 1;
      continue;
    }

    if (
      shouldSendBackgroundCheckExpiryWarning(cleared, p.backgroundCheckExpiryWarningSentAt) &&
      !p.backgroundCheckExpiryWarningSentAt
    ) {
      await prisma.$transaction([
        prisma.trainerProfile.update({
          where: { trainerId: p.trainerId },
          data: { backgroundCheckExpiryWarningSentAt: new Date() },
        }),
        prisma.trainerNotification.create({
          data: {
            trainerId: p.trainerId,
            kind: "COMPLIANCE",
            title: "Renew your background check soon",
            body: "Your Match Fit background screening must be renewed within the next 30 days to stay active on the platform.",
            linkHref: "/trainer/dashboard/compliance",
          },
        }),
      ]);
      warnings += 1;
    }
  }

  return { warnings, suspensions };
}

async function autoCompleteSessions(): Promise<number> {
  const now = new Date();
  const due = await prisma.bookedTrainingSession.findMany({
    where: {
      status: "PENDING_CONFIRMATION",
      confirmationDeadlineAt: { lt: now },
    },
    select: { id: true, clientId: true, trainerId: true },
  });
  for (const s of due) {
    await prisma.$transaction([
      prisma.bookedTrainingSession.update({
        where: { id: s.id },
        data: { status: "AUTO_COMPLETED", updatedAt: now },
      }),
      prisma.clientNotification.create({
        data: {
          clientId: s.clientId,
          kind: "SYSTEM",
          title: "Session marked complete",
          body: "The confirmation window for your booked session has ended with no dispute filed. The session is marked complete and trainer payout rules apply.",
          linkHref: `/client/messages`,
        },
      }),
    ]);
  }
  return due.length;
}

async function diyMissedDeliveries(): Promise<number> {
  const now = new Date();
  const missed = await prisma.diyPlanEngagement.findMany({
    where: {
      status: "PENDING_DELIVERY",
      firstDeliveredAt: null,
      firstDeliverByAt: { lt: now },
    },
    select: { id: true, clientId: true, trainerId: true },
  });
  for (const d of missed) {
    await prisma.$transaction([
      prisma.diyPlanEngagement.update({
        where: { id: d.id },
        data: { status: "REFUND_ALERT_SENT", updatedAt: now },
      }),
      prisma.clientNotification.create({
        data: {
          clientId: d.clientId,
          kind: "BILLING",
          title: "DIY delivery deadline missed",
          body: "Your coach did not upload the first DIY plan by the required deadline. You may be eligible for a refund of the service amount (the 20% administrative fee remains non-refundable per Terms). Contact Match Fit support to complete your refund.",
          linkHref: "/client/dashboard/messages",
        },
      }),
    ]);
  }
  return missed.length;
}

export async function runMatchFitTosCronJobs(): Promise<TosCronSummary> {
  const backfill = await backfillApprovedBackgroundCheckTimestamps();
  const { warnings, suspensions } = await processBackgroundCheckRenewals();
  const sessionsAutoCompleted = await autoCompleteSessions();
  const diyRefundAlerts = await diyMissedDeliveries();
  return {
    backgroundCheckClearedBackfill: backfill,
    backgroundCheckWarningsSent: warnings,
    backgroundCheckSuspensions: suspensions,
    sessionsAutoCompleted,
    diyRefundAlerts,
  };
}
