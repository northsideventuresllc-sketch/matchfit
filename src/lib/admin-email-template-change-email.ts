import { MATCH_FIT_EMAIL_TEMPLATE_APPROVAL_INBOX } from "@/lib/match-fit-email-template-owner";
import {
  signEmailTemplateChangeDecisionToken,
  signEmailTemplateChangeDenyFeedbackToken,
} from "@/lib/email-template-change-token";
import { sendMatchFitBrandedEmail } from "@/lib/match-fit-branded-email";
import { MF_EMAIL_SITE } from "@/lib/match-fit-email-brand";
import { escapeHtmlEmail, wrapMatchFitTransactionalHtml } from "@/lib/match-fit-email-shell";
import { transactionalEmailKindSampleLabel, type TransactionalEmailKind } from "@/lib/transactional-email-kinds";
import { previewTransactionalEmailTemplate } from "@/lib/transactional-email-template-store";
import type { TransactionalEmailTemplateFields } from "@/lib/transactional-email-template-types";

export async function sendEmailTemplateChangeApprovalRequest(opts: {
  pendingId: string;
  kind: TransactionalEmailKind;
  fields: TransactionalEmailTemplateFields;
  requesterName: string;
  requesterCode: string;
  origin: string;
}): Promise<void> {
  const approveTok = await signEmailTemplateChangeDecisionToken(opts.pendingId, "approve");
  const denyFeedbackTok = await signEmailTemplateChangeDenyFeedbackToken(opts.pendingId);
  const approveUrl = `${opts.origin}/api/admin/email-template-change-decision?token=${encodeURIComponent(approveTok)}`;
  const denyUrl = `${opts.origin}/admin/email-templates/deny?token=${encodeURIComponent(denyFeedbackTok)}`;
  const label = transactionalEmailKindSampleLabel(opts.kind);
  const preview = previewTransactionalEmailTemplate(opts.kind, opts.fields);
  const s = MF_EMAIL_SITE;

  const subject = `[Match Fit] Email template change — ${label}`;
  const text = [
    "An administrator submitted a change to a Match Fit automated email template.",
    "",
    `Template: ${label} (${opts.kind})`,
    `Submitted by: ${opts.requesterName} (${opts.requesterCode})`,
    "",
    `Approve: ${approveUrl}`,
    `Review & deny: ${denyUrl}`,
  ].join("\n");

  const html = wrapMatchFitTransactionalHtml({
    preheader: `${opts.requesterCode} proposed a template update.`,
    title: "Email template review",
    bodyHtml: [
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${s.textMuted};text-align:center;max-width:520px;margin-left:auto;margin-right:auto;"><strong style="color:${s.textPrimary};">${escapeHtmlEmail(label)}</strong> — submitted by ${escapeHtmlEmail(opts.requesterName)} (<code style="color:${s.gold};">${escapeHtmlEmail(opts.requesterCode)}</code>).</p>`,
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${s.textMuted};text-align:center;max-width:520px;margin-left:auto;margin-right:auto;">Subject preview: <strong style="color:${s.textPrimary};">${escapeHtmlEmail(preview.subject)}</strong></p>`,
      `<table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:20px auto 0;"><tr><td style="padding:0 8px;"><a href="${escapeHtmlEmail(approveUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:${s.orange};color:${s.bg};font-weight:800;text-decoration:none;font-size:13px;">Approve</a></td><td style="padding:0 8px;"><a href="${escapeHtmlEmail(denyUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:${s.red};color:#fff;font-weight:800;text-decoration:none;font-size:13px;">Deny</a></td></tr></table>`,
    ].join(""),
  });

  await sendMatchFitBrandedEmail({
    to: MATCH_FIT_EMAIL_TEMPLATE_APPROVAL_INBOX.trim(),
    subject,
    text,
    html,
  });
}

export async function sendEmailTemplateChangeDeniedNotice(opts: {
  to: string;
  kind: TransactionalEmailKind;
  reviewNotes: string;
  requesterName: string;
}): Promise<void> {
  const label = transactionalEmailKindSampleLabel(opts.kind);
  const s = MF_EMAIL_SITE;
  const subject = `[Match Fit] Email template change not approved — ${label}`;
  const text = [
    `Hi ${opts.requesterName},`,
    "",
    `Your proposed change to the "${label}" email template was not approved.`,
    "",
    "Feedback:",
    opts.reviewNotes,
    "",
    "Open the Email Templates page in the Administrator Portal to revise and resubmit.",
    "",
    "— Match Fit",
  ].join("\n");

  const html = wrapMatchFitTransactionalHtml({
    preheader: "Your template edit needs adjustments.",
    title: "Change not approved",
    bodyHtml: [
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${s.textMuted};text-align:center;max-width:520px;margin-left:auto;margin-right:auto;">Hi <strong style="color:${s.textPrimary};">${escapeHtmlEmail(opts.requesterName)}</strong> — your proposed update to <strong style="color:${s.textPrimary};">${escapeHtmlEmail(label)}</strong> was not approved.</p>`,
      `<p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:${s.textMuted};text-align:left;max-width:520px;margin-left:auto;margin-right:auto;padding:14px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);background:rgba(0,0,0,0.25);white-space:pre-wrap;">${escapeHtmlEmail(opts.reviewNotes)}</p>`,
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${s.textMuted};text-align:center;max-width:520px;margin-left:auto;margin-right:auto;">Revise the template in the Administrator Portal and save again when ready.</p>`,
    ].join(""),
  });

  await sendMatchFitBrandedEmail({ to: opts.to.trim(), subject, text, html });
}

export async function sendEmailTemplateChangeApprovedNotice(opts: {
  to: string;
  kind: TransactionalEmailKind;
  requesterName: string;
}): Promise<void> {
  const label = transactionalEmailKindSampleLabel(opts.kind);
  const s = MF_EMAIL_SITE;
  const subject = `[Match Fit] Email template approved — ${label}`;
  const text = [
    `Hi ${opts.requesterName},`,
    "",
    `Your change to the "${label}" email template was approved and is now live for future automated emails.`,
    "",
    "— Match Fit",
  ].join("\n");

  const html = wrapMatchFitTransactionalHtml({
    preheader: "Your template edit is live.",
    title: "Change approved",
    bodyHtml: `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${s.textMuted};text-align:center;max-width:520px;margin-left:auto;margin-right:auto;">Hi <strong style="color:${s.textPrimary};">${escapeHtmlEmail(opts.requesterName)}</strong> — your update to <strong style="color:${s.textPrimary};">${escapeHtmlEmail(label)}</strong> is approved and active.</p>`,
  });

  await sendMatchFitBrandedEmail({ to: opts.to.trim(), subject, text, html });
}
