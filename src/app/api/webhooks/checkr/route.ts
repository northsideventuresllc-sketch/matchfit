import {
  parseCheckrWebhookReportOutcome,
  verifyCheckrWebhookSignature,
  checkrWebhookIndicatesClear,
  checkrWebhookIndicatesConsider,
  checkrWebhookIndicatesDenied,
} from "@/lib/checkr";
import { recordCheckrBackgroundCheckPaid } from "@/lib/checkr-webhook-records";
import { notifySupportPlanBReviewNeeded } from "@/lib/background-check-plan-b";
import { isBackgroundCheckPlanBActive } from "@/lib/checkr-integration";
import { prisma } from "@/lib/prisma";
import {
  applyTrainerBackgroundCheckReviewOutcome,
  syncTrainerComplianceWindow,
} from "@/lib/trainer-compliance-window-sync";
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

  if (checkrWebhookIndicatesDenied(outcome)) {
    await applyTrainerBackgroundCheckReviewOutcome({
      trainerId,
      backgroundCheckStatus: "DENIED",
      reportId: outcome.reportId,
      candidateId: outcome.candidateId,
    });
    return NextResponse.json({ ok: true, status: "denied" });
  }

  if (checkrWebhookIndicatesConsider(outcome)) {
    await applyTrainerBackgroundCheckReviewOutcome({
      trainerId,
      backgroundCheckStatus: "NEEDS_FURTHER_REVIEW",
      reportId: outcome.reportId,
      candidateId: outcome.candidateId,
    });
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

  await applyTrainerBackgroundCheckReviewOutcome({
    trainerId,
    backgroundCheckStatus: "APPROVED",
    reportId: outcome.reportId,
    candidateId: outcome.candidateId,
  });

  await syncTrainerComplianceWindow(trainerId);
  await maybeActivateTrainerDashboard(trainerId);

  return NextResponse.json({ ok: true, status: "approved" });
}
