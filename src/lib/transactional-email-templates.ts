/**
 * Transactional email bodies. Use {@link wrapMatchFitTransactionalHtml}: orange
 * {@link matchFitEmailHeroKickerHtml}, white hero title always ALL CAPS via
 * {@link escapeHtmlEmailHeroTitle}. Subject lines are human-written;
 * {@link formatTransactionalEmailSubject} only trims and collapses whitespace.
 *
 * Editable copy lives in {@link getDefaultTransactionalEmailTemplateFields}; admin overrides
 * are merged at send time via {@link buildTransactionalEmailWithOverrides}.
 */
import type { TransactionalEmailKind } from "@/lib/transactional-email-kinds";
import { compileTransactionalEmail } from "@/lib/transactional-email-template-compile";
import { getDefaultTransactionalEmailTemplateFields } from "@/lib/transactional-email-template-defaults";
import {
  mergeTransactionalEmailTemplateFields,
  type TransactionalEmailTemplateFields,
} from "@/lib/transactional-email-template-types";

function appBaseUrlForEmailSample(): string {
  const u = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  return u || "https://match-fit.net";
}

export function buildTransactionalEmail(
  kind: TransactionalEmailKind,
  ctx: Record<string, string>,
  fieldsOverride?: TransactionalEmailTemplateFields | null,
): { subject: string; text: string; html: string } {
  const defaults = getDefaultTransactionalEmailTemplateFields(kind);
  const fields = fieldsOverride ? mergeTransactionalEmailTemplateFields(defaults, fieldsOverride) : defaults;
  return compileTransactionalEmail(kind, ctx, fields);
}

/** Sample context for internal preview sends (one per kind). */
export function sampleContextForTransactionalEmail(kind: TransactionalEmailKind): Record<string, string> {
  void kind;
  const base = {
    firstName: "Alex",
    code: "482913",
    resetUrl: `${appBaseUrlForEmailSample()}/client/reset-password?token=sample`,
    confirmUrl: `${appBaseUrlForEmailSample()}/client/settings/confirm-email-change?token=sample`,
    newEmail: "new.address@example.com",
    dashboardUrl: `${appBaseUrlForEmailSample()}/client`,
    trainerDashboardUrl: `${appBaseUrlForEmailSample()}/trainer/dashboard`,
    trainerUsername: "coachjordan",
    clientUsername: "clientalex",
    amount: "$120.00",
    itemLabel: "8-session strength package",
    payoutAmount: "$640.00",
    periodLabel: "May 1–15, 2026",
    statusLine: "Your Match Fit membership is active.",
    detailLine: "Next renewal: June 1, 2026",
    violationSummary:
      "We observed messaging that may reference taking payments outside Match Fit. Please keep purchases on-platform.",
    reportId: "BR-20481",
    moderationSummary: "A FitHub post was flagged. No action is required if the content follows community guidelines.",
    inquiryNote: "A client expressed interest in working with you from Find Coaches.",
    adminName: "Jamie Rivera",
    adminEmail: "jamie@example.com",
    adminNotes: "DOB 1990-01-01 · Proposed admin code: AB12CD34",
    approveUrl: `${appBaseUrlForEmailSample()}/api/admin/pending-decision?token=sample-approve`,
    denyUrl: `${appBaseUrlForEmailSample()}/api/admin/pending-decision?token=sample-deny`,
    certName: "NASM CPT",
    expiryDate: "2026-08-01",
    bgStatus: "CLEAR",
    ipLine: "Near your usual sign-in location",
    deviceLine: "Chrome on macOS",
    loginTime: new Date().toISOString(),
    policyName: "Terms of Service",
    policyUrl: `${appBaseUrlForEmailSample()}/terms`,
    referenceId: "svc_tx_sample",
    w9Summary: "Legal name: Alex Coach · TIN on file · Address on file (see dashboard for full W-9).",
    interestsUrl: `${appBaseUrlForEmailSample()}/trainer/dashboard/interests`,
    coachName: "Jordan Lee",
    startLabel: "Thu, May 15, 2026, 3:00 PM",
    sessionDelivery: "VIRTUAL",
    videoPlatform: "Google Meet",
    joinUrl: `${appBaseUrlForEmailSample()}/trainer/signup?betaInvite=sample`,
    messagesThreadUrl: `${appBaseUrlForEmailSample()}/client/dashboard/messages/coachjordan`,
    trainerName: "Jordan Smith",
    trainerEmail: "coach@example.com",
    trainerPhone: "(555) 555-0100",
    serviceZip: "94102",
    trainerId: "sample-trainer-id",
    confirmInviteSentUrl: `${appBaseUrlForEmailSample()}/api/background-check/plan-b/staff-action?token=sample`,
    status: "PENDING",
    queuePosition: "3",
    reservedUsername: "coachalex",
    slotExpiresLabel: "June 13, 2026",
    supportUrl: `${appBaseUrlForEmailSample()}/`,
    trialDays: "60",
    trialEndLabel: "August 1, 2026",
    monthlyUsd: "10.00",
    paymentGraceDays: "14",
    paymentGraceUntilLabel: "August 15, 2026",
    signupResumeUrl: `${appBaseUrlForEmailSample()}/trainer/signup`,
  };
  return base;
}
