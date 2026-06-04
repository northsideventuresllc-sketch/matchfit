import {
  parseCheckrWebhookReportOutcome,
  recordCheckrBackgroundCheckPaid,
  verifyCheckrWebhookSignature,
  checkrWebhookIndicatesClear,
  checkrWebhookIndicatesConsider,
} from "@/lib/checkr";
import { notifySupportPlanBReviewNeeded } from "@/lib/background-check-plan-b";
import { isBackgroundCheckPlanBActive } from "@/lib/checkr-integration";
import { prisma } from "@/lib/prisma";
import { syncTrainerComplianceWindow } from "@/lib/trainer-compliance-window-sync";
import { maybeActivateTrainerDashboard } from "@/lib/trainer-onboarding-dashboard";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function checkrWebhookAuthorized(req: Request, rawBody: string): boolean {
  const secret = process.env.CHECKR_WEBHOOK_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const signature =
    req.headers.get("x-checkr-signature") ??
    req.headers.get("X-Checkr-Signature") ??
    req.headers.get("x-checkr-signature-256");
  return verifyCheckrWebhookSignature(rawBody, signature, secret);
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!checkrWebhookAuthorized(req, raw)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const outcome = parseCheckrWebhookReportOutcome(body);
  if (!outcome) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  let trainerId = outcome.externalTrainerId?.trim();
  if (!trainerId && outcome.candidateId) {
    const prof = await prisma.trainerProfile.findFirst({
      where: { checkrCandidateId: outcome.candidateId },
      select: { trainerId: true },
    });
    trainerId = prof?.trainerId;
  }
  if (!trainerId) {
    return NextResponse.json({ ok: true, ignored: true, reason: "no_trainer_mapping" });
  }

  const now = new Date();

  if (checkrWebhookIndicatesConsider(outcome)) {
    await prisma.trainerProfile.update({
      where: { trainerId },
      data: {
        backgroundCheckStatus: "NEEDS_FURTHER_REVIEW",
        backgroundCheckReviewStatus: "NEEDS_FURTHER_REVIEW",
        ...(outcome.reportId ? { checkrReportId: outcome.reportId } : {}),
        ...(outcome.candidateId ? { checkrCandidateId: outcome.candidateId } : {}),
        updatedAt: now,
      },
    });
    await syncTrainerComplianceWindow(trainerId);
    if (isBackgroundCheckPlanBActive()) {
      await notifySupportPlanBReviewNeeded(trainerId);
    }
    return NextResponse.json({ ok: true, status: "needs_review" });
  }

  if (!checkrWebhookIndicatesClear(outcome) || !outcome.vendorPaidCents) {
    return NextResponse.json({ ok: true, ignored: true, reason: "not_terminal_clear" });
  }

  await recordCheckrBackgroundCheckPaid({
    trainerId,
    vendorPaidCents: outcome.vendorPaidCents,
    reportId: outcome.reportId,
    candidateId: outcome.candidateId,
  });

  await prisma.trainerProfile.update({
    where: { trainerId },
    data: {
      backgroundCheckStatus: "APPROVED",
      backgroundCheckReviewStatus: "APPROVED",
      backgroundCheckClearedAt: now,
      updatedAt: now,
    },
  });

  await syncTrainerComplianceWindow(trainerId);
  await maybeActivateTrainerDashboard(trainerId);

  return NextResponse.json({ ok: true, status: "approved" });
}
