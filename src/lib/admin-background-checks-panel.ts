import "server-only";

import type {
  AdminBackgroundCheckEntry,
  AdminBackgroundCheckQueueKind,
  AdminBackgroundChecksPanel,
  AdminBackgroundCheckPlatformMode,
} from "@/lib/admin-portal-types";
import { launchTrainerCountWhere } from "@/lib/launch-account-counts";
import { isBackgroundCheckPlanBActive } from "@/lib/checkr-integration";
import { resolveTrainerBackgroundCheckUiMode } from "@/lib/trainer-background-check-ui";
import { prisma } from "@/lib/prisma";

const BG_FAILED_STATUSES = new Set(["DENIED", "NEEDS_FURTHER_REVIEW", "REJECTED", "CONSIDER", "PENDING_REVIEW"]);

const BG_EMAIL_KINDS = [
  "BACKGROUND_CHECK_UPDATE",
  "BACKGROUND_CHECK_PLAN_B_INVITE_SENT_TRAINER",
] as const;

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function trainerDisplayName(args: {
  preferredName: string | null;
  firstName: string;
  lastName: string;
  username: string;
}): string {
  const preferred = args.preferredName?.trim();
  if (preferred) return preferred;
  const full = [args.firstName, args.lastName].filter(Boolean).join(" ").trim();
  return full || args.username;
}

/** Client-safe classification for tests and UI labels. */
export function classifyBackgroundCheckQueueEntry(args: {
  backgroundCheckStatus: string;
  inviteRequestedAt: string | Date | null;
  inviteSentAt: string | Date | null;
  checkrCandidateId: string | null;
  planBActive: boolean;
  hasPaidBackgroundFee: boolean;
}): AdminBackgroundCheckQueueKind {
  const status = (args.backgroundCheckStatus ?? "").trim().toUpperCase();
  if (status === "APPROVED") return "approved";
  if (BG_FAILED_STATUSES.has(status)) return "failed";

  const requestedAt = args.inviteRequestedAt ? new Date(args.inviteRequestedAt).getTime() : null;
  const sentAt = args.inviteSentAt ? new Date(args.inviteSentAt).getTime() : null;

  if (requestedAt && !sentAt) return "awaiting_manual_invite";

  if (sentAt) {
    const automated =
      Boolean(args.checkrCandidateId?.trim()) &&
      requestedAt !== null &&
      Math.abs(sentAt - requestedAt) <= 2 * 60 * 1000;
    return automated ? "automated_invite_sent" : "manual_invite_sent";
  }

  if (!args.planBActive && args.hasPaidBackgroundFee && (status === "PENDING" || status === "NOT_STARTED")) {
    return "plan_a_pending";
  }

  if (status === "PENDING") return "screening_in_progress";
  return "other";
}

function queuePriority(kind: AdminBackgroundCheckQueueKind): number {
  switch (kind) {
    case "awaiting_manual_invite":
      return 0;
    case "plan_a_pending":
      return 1;
    case "automated_invite_sent":
      return 2;
    case "manual_invite_sent":
      return 3;
    case "screening_in_progress":
      return 4;
    case "failed":
      return 5;
    case "approved":
      return 6;
    default:
      return 7;
  }
}

function queueLabel(kind: AdminBackgroundCheckQueueKind): string {
  switch (kind) {
    case "awaiting_manual_invite":
      return "Awaiting manual Checkr invite";
    case "automated_invite_sent":
      return "Automated invite sent (Plan A / API)";
    case "manual_invite_sent":
      return "Manual invite confirmed sent";
    case "plan_a_pending":
      return "Plan A — paid, awaiting Checkr";
    case "screening_in_progress":
      return "Screening in progress";
    case "approved":
      return "Approved";
    case "failed":
      return "Needs review / denied";
    default:
      return "Other";
  }
}

function resolvePlatformMode(): AdminBackgroundCheckPlatformMode {
  const mode = resolveTrainerBackgroundCheckUiMode();
  if (mode === "plan_b") return "plan_b";
  if (mode === "checkr_api") return "plan_a";
  return "unconfigured";
}

export async function getAdminBackgroundChecksPanel(): Promise<AdminBackgroundChecksPanel> {
  const planBActive = isBackgroundCheckPlanBActive();
  const platformMode = resolvePlatformMode();

  const trainers = await prisma.trainer.findMany({
    where: {
      ...launchTrainerCountWhere(),
      profile: {
        is: {
          OR: [
            { backgroundCheckInviteRequestedAt: { not: null } },
            { backgroundCheckInviteSentAt: { not: null } },
            { hasPaidBackgroundFee: true },
            {
              backgroundCheckStatus: {
                in: ["PENDING", "DENIED", "NEEDS_FURTHER_REVIEW", "REJECTED", "CONSIDER", "PENDING_REVIEW"],
              },
            },
          ],
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
    select: {
      id: true,
      email: true,
      username: true,
      preferredName: true,
      firstName: true,
      lastName: true,
      profile: {
        select: {
          backgroundCheckStatus: true,
          backgroundCheckReviewStatus: true,
          backgroundCheckInviteRequestedAt: true,
          backgroundCheckInviteSentAt: true,
          checkrCandidateId: true,
          checkrReportId: true,
          hasPaidBackgroundFee: true,
          backgroundCheckClearedAt: true,
        },
      },
    },
  });

  const trainerIds = trainers.map((t) => t.id);
  const emailRows =
    trainerIds.length > 0
      ? await prisma.transactionalEmailDelivery.findMany({
          where: {
            trainerId: { in: trainerIds },
            kind: { in: [...BG_EMAIL_KINDS] },
            status: "sent",
          },
          orderBy: { createdAt: "desc" },
          select: {
            trainerId: true,
            kind: true,
            toEmail: true,
            createdAt: true,
            subject: true,
          },
        })
      : [];

  const latestEmailByTrainer = new Map<
    string,
    { kind: string; toEmail: string; sentAt: string; subject: string }
  >();
  for (const row of emailRows) {
    if (!row.trainerId || latestEmailByTrainer.has(row.trainerId)) continue;
    latestEmailByTrainer.set(row.trainerId, {
      kind: row.kind,
      toEmail: row.toEmail,
      sentAt: row.createdAt.toISOString(),
      subject: row.subject,
    });
  }

  const entries: AdminBackgroundCheckEntry[] = trainers
    .filter((t) => t.profile)
    .map((t) => {
      const profile = t.profile!;
      const queueKind = classifyBackgroundCheckQueueEntry({
        backgroundCheckStatus: profile.backgroundCheckStatus ?? "NOT_STARTED",
        inviteRequestedAt: profile.backgroundCheckInviteRequestedAt,
        inviteSentAt: profile.backgroundCheckInviteSentAt,
        checkrCandidateId: profile.checkrCandidateId,
        planBActive,
        hasPaidBackgroundFee: profile.hasPaidBackgroundFee,
      });

      const waitingSince =
        queueKind === "awaiting_manual_invite"
          ? toIso(profile.backgroundCheckInviteRequestedAt)
          : queueKind === "automated_invite_sent" || queueKind === "manual_invite_sent"
            ? toIso(profile.backgroundCheckInviteSentAt)
            : toIso(profile.backgroundCheckInviteRequestedAt) ?? toIso(profile.backgroundCheckInviteSentAt);

      return {
        trainerId: t.id,
        username: t.username,
        displayName: trainerDisplayName(t),
        email: t.email,
        backgroundCheckStatus: profile.backgroundCheckStatus ?? "NOT_STARTED",
        backgroundCheckReviewStatus: profile.backgroundCheckReviewStatus,
        inviteRequestedAt: toIso(profile.backgroundCheckInviteRequestedAt),
        inviteSentAt: toIso(profile.backgroundCheckInviteSentAt),
        checkrCandidateId: profile.checkrCandidateId,
        checkrReportId: profile.checkrReportId,
        clearedAt: toIso(profile.backgroundCheckClearedAt),
        queueKind,
        queueLabel: queueLabel(queueKind),
        waitingSince,
        latestEmail: latestEmailByTrainer.get(t.id) ?? null,
        canConfirmInviteSent: queueKind === "awaiting_manual_invite",
      };
    })
    .sort((a, b) => {
      const priorityDiff = queuePriority(a.queueKind) - queuePriority(b.queueKind);
      if (priorityDiff !== 0) return priorityDiff;
      const aTime = a.waitingSince ? new Date(a.waitingSince).getTime() : 0;
      const bTime = b.waitingSince ? new Date(b.waitingSince).getTime() : 0;
      return aTime - bTime;
    });

  const activeEntries = entries.filter((e) => e.queueKind !== "approved");

  return {
    platformMode,
    planBActive,
    awaitingManualInvite: entries.filter((e) => e.queueKind === "awaiting_manual_invite"),
    automatedInvitesSent: entries.filter((e) => e.queueKind === "automated_invite_sent"),
    manualInvitesSent: entries.filter((e) => e.queueKind === "manual_invite_sent"),
    planAPending: entries.filter((e) => e.queueKind === "plan_a_pending"),
    activeEntries,
    summary: {
      awaitingManualInvite: entries.filter((e) => e.queueKind === "awaiting_manual_invite").length,
      automatedInvitesSent: entries.filter((e) => e.queueKind === "automated_invite_sent").length,
      manualInvitesSent: entries.filter((e) => e.queueKind === "manual_invite_sent").length,
      planAPending: entries.filter((e) => e.queueKind === "plan_a_pending").length,
      screeningInProgress: entries.filter(
        (e) => e.queueKind === "screening_in_progress" || e.queueKind === "other",
      ).length,
      failed: entries.filter((e) => e.queueKind === "failed").length,
    },
  };
}
