import { retrieveCheckrReport, type CheckrReport } from "@/lib/checkr/client";
import { backgroundCheckOutcomeFromCheckrReport } from "@/lib/checkr/report-outcome";
import { sendTrainerBackgroundCheckReviewEmail } from "@/lib/trainer-background-check-review-email";
import { sendTrainerBackgroundCheckStatusEmail } from "@/lib/trainer-background-check-status-email";
import { upsertTrainerCheckrVault, findTrainerIdByCheckrReportId } from "@/lib/supabase/checkr-vault";
import { maybeActivateTrainerDashboard } from "@/lib/trainer-onboarding-dashboard";
import { prisma } from "@/lib/prisma";
import { getAppOriginFromEnv } from "@/lib/app-origin";

export async function applyCheckrReportToTrainer(args: {
  trainerId: string;
  report: CheckrReport;
  origin?: string;
}): Promise<void> {
  const outcome = backgroundCheckOutcomeFromCheckrReport(args.report);
  const reportId = args.report.id;

  await upsertTrainerCheckrVault(args.trainerId, {
    checkr_report_id: reportId,
    report_portal_url: args.report.uri ?? null,
  });

  const trainer = await prisma.trainer.findUnique({
    where: { id: args.trainerId },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      username: true,
      profile: { select: { backgroundCheckStatus: true, backgroundCheckHumanReviewRequestedAt: true } },
    },
  });
  if (!trainer?.profile) return;

  if (trainer.profile.backgroundCheckStatus === "DENIED") return;

  const origin = args.origin ?? getAppOriginFromEnv();

  if (outcome === "IN_PROGRESS" || outcome === "UNKNOWN") {
    await prisma.trainerProfile.update({
      where: { trainerId: args.trainerId },
      data: {
        backgroundCheckStatus: "PENDING",
        backgroundCheckReviewStatus: "PENDING",
        checkrReportId: reportId,
      },
    });
    return;
  }

  if (outcome === "CLEAR") {
    const clearedAt = new Date();
    await prisma.trainerProfile.update({
      where: { trainerId: args.trainerId },
      data: {
        backgroundCheckStatus: "APPROVED",
        backgroundCheckReviewStatus: "APPROVED",
        backgroundCheckClearedAt: clearedAt,
        backgroundCheckExpiryWarningSentAt: null,
        checkrReportId: reportId,
      },
    });
    await maybeActivateTrainerDashboard(args.trainerId);
    await sendTrainerBackgroundCheckStatusEmail({
      trainerEmail: trainer.email,
      trainerName: `${trainer.firstName} ${trainer.lastName}`.trim(),
      statusLabel: "APPROVED",
      origin,
    });
    return;
  }

  // FLAGGED — require human review before continuing onboarding
  const alreadyRequested = Boolean(trainer.profile.backgroundCheckHumanReviewRequestedAt);
  await prisma.trainerProfile.update({
    where: { trainerId: args.trainerId },
    data: {
      backgroundCheckStatus: "NEEDS_FURTHER_REVIEW",
      backgroundCheckReviewStatus: "NEEDS_FURTHER_REVIEW",
      checkrReportId: reportId,
      ...(alreadyRequested ? {} : { backgroundCheckHumanReviewRequestedAt: new Date() }),
    },
  });

  if (!alreadyRequested) {
    await sendTrainerBackgroundCheckReviewEmail({
      trainerId: args.trainerId,
      trainerName: `${trainer.firstName} ${trainer.lastName}`.trim(),
      trainerEmail: trainer.email,
      trainerUsername: trainer.username,
      reportId,
      reportPortalUrl: args.report.uri ?? null,
      origin,
    });
  }

  await sendTrainerBackgroundCheckStatusEmail({
    trainerEmail: trainer.email,
    trainerName: `${trainer.firstName} ${trainer.lastName}`.trim(),
    statusLabel: "NEEDS_FURTHER_REVIEW",
    origin,
  });
}

export async function resolveTrainerFromCheckrWebhook(payload: {
  type?: string;
  data?: { object?: Record<string, unknown> };
}): Promise<{ trainerId: string; report: CheckrReport } | null> {
  const obj = payload.data?.object;
  if (!obj || typeof obj !== "object") return null;

  const reportId =
    (typeof obj.id === "string" && payload.type?.startsWith("report.") ? obj.id : null) ||
    (typeof obj.report_id === "string" ? obj.report_id : null);

  if (!reportId) return null;

  let trainerId = await findTrainerIdByCheckrReportId(reportId);

  if (!trainerId && typeof obj.candidate_id === "string") {
    const { getSupabaseServiceClient } = await import("@/lib/supabase/service-client");
    const supabase = getSupabaseServiceClient();
    if (supabase) {
      const { data } = await supabase
        .from("trainer_checkr_vault")
        .select("trainer_id")
        .eq("checkr_candidate_id", obj.candidate_id)
        .maybeSingle();
      if (data?.trainer_id) trainerId = String(data.trainer_id);
    }
  }

  if (!trainerId) {
    const byProfile = await prisma.trainerProfile.findFirst({
      where: { checkrReportId: reportId },
      select: { trainerId: true },
    });
    trainerId = byProfile?.trainerId ?? null;
  }

  if (!trainerId) return null;

  const report = await retrieveCheckrReport(reportId);
  await upsertTrainerCheckrVault(trainerId, {
    checkr_report_id: reportId,
    report_portal_url: report.uri ?? null,
    last_webhook_type: payload.type ?? null,
    last_webhook_payload: payload as Record<string, unknown>,
  });

  return { trainerId, report };
}
