import { MF_EMAIL_SITE } from "@/lib/match-fit-email-brand";
import { escapeHtmlEmail, formatTransactionalEmailSubject, wrapMatchFitTransactionalHtml } from "@/lib/match-fit-email-shell";
import type { TransactionalEmailKind } from "@/lib/transactional-email-kinds";
import type { TransactionalEmailTemplateFields } from "@/lib/transactional-email-template-types";

function c(s: string | undefined, fallback: string): string {
  const t = s?.trim();
  return t && t.length > 0 ? t : fallback;
}

/** Replace {{key}} placeholders; values are HTML-escaped when inserted into HTML templates. */
export function interpolateEmailTemplate(template: string, ctx: Record<string, string>, escapeValues: boolean): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const val = c(ctx[key], "");
    return escapeValues ? escapeHtmlEmail(val) : val;
  });
}

function bodyParagraphsHtml(htmlLines: string[]): string {
  const s = MF_EMAIL_SITE;
  return htmlLines
    .filter((line) => line.trim().length > 0)
    .map(
      (line) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${s.textMuted};text-align:center;max-width:480px;margin-left:auto;margin-right:auto;">${line}</p>`,
    )
    .join("");
}

function dualActionButtons(approveUrl: string, denyUrl: string): string {
  const s = MF_EMAIL_SITE;
  return `<table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:20px auto 0;"><tr><td style="padding:0 8px;"><a href="${escapeHtmlEmail(approveUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:${s.orange};color:${s.bg};font-weight:800;text-decoration:none;font-size:13px;">Approve</a></td><td style="padding:0 8px;"><a href="${escapeHtmlEmail(denyUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:${s.red};color:#fff;font-weight:800;text-decoration:none;font-size:13px;">Deny</a></td></tr></table>`;
}

function confirmButtonHtml(href: string, label: string): string {
  const s = MF_EMAIL_SITE;
  return `<table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:20px auto 0;"><tr><td><a href="${escapeHtmlEmail(href)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:${s.orange};color:${s.bg};font-weight:800;text-decoration:none;font-size:13px;">${escapeHtmlEmail(label)}</a></td></tr></table>`;
}

function bookingSessionExtraHtml(ctx: Record<string, string>): string {
  const s = MF_EMAIL_SITE;
  const sessionDelivery = (c(ctx.sessionDelivery, "VIRTUAL").trim().toUpperCase() === "IN_PERSON" ? "IN_PERSON" : "VIRTUAL") as
    | "IN_PERSON"
    | "VIRTUAL";
  const videoPlatform = c(ctx.videoPlatform, "Google Meet").trim();
  const joinUrl = (typeof ctx.joinUrl === "string" ? ctx.joinUrl : "").trim();

  if (sessionDelivery === "VIRTUAL") {
    if (joinUrl) {
      const platformLine = videoPlatform
        ? `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${s.textMuted};text-align:center;max-width:480px;margin-left:auto;margin-right:auto;">Video platform: <strong style="color:${s.textPrimary};">${escapeHtmlEmail(videoPlatform)}</strong>.</p>`
        : "";
      return `${platformLine}<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${s.textMuted};text-align:center;max-width:520px;margin-left:auto;margin-right:auto;">Join link:<br /><a href="${escapeHtmlEmail(joinUrl)}" style="color:${s.gold};word-break:break-all;font-weight:700;">${escapeHtmlEmail(joinUrl)}</a></p>`;
    }
    return `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${s.textMuted};text-align:center;max-width:480px;margin-left:auto;margin-right:auto;">If you do not see a link below yet, your coach can attach Google Meet, Zoom, or Microsoft Teams from your Match Fit messages before the session.</p>`;
  }
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${s.textMuted};text-align:center;max-width:480px;margin-left:auto;margin-right:auto;">Use Messages to coordinate the meeting location with your coach.</p>`;
}

export function compileTransactionalEmail(
  kind: TransactionalEmailKind,
  ctx: Record<string, string>,
  fields: TransactionalEmailTemplateFields,
): { subject: string; text: string; html: string } {
  void kind;
  const s = MF_EMAIL_SITE;
  const subject = formatTransactionalEmailSubject(interpolateEmailTemplate(fields.subject, ctx, false));
  const text = interpolateEmailTemplate(fields.textBody, ctx, false);
  const preheader = interpolateEmailTemplate(fields.preheader, ctx, false);
  const title = interpolateEmailTemplate(fields.title, ctx, false);

  const bodyLines = fields.bodyParagraphs.map((p) => interpolateEmailTemplate(p, ctx, true));
  let bodyHtml = bodyParagraphsHtml(bodyLines);

  const layout = fields.layout;

  if (layout.type === "otp") {
    const codeKey = layout.codeKey ?? "code";
    const code = c(ctx[codeKey], "123456");
    bodyHtml = `${bodyParagraphsHtml([bodyLines[0] ?? "Enter this code to continue signing in to Match Fit:"])}<p style="margin:8px 0 20px;font-family:ui-monospace,monospace;font-size:28px;font-weight:800;letter-spacing:0.25em;color:${s.gold};text-align:center;">${escapeHtmlEmail(code)}</p>${bodyParagraphsHtml(bodyLines.slice(1))}`;
    const html = wrapMatchFitTransactionalHtml({ preheader, title, bodyHtml });
    return { subject, text, html };
  }

  if (layout.type === "dual-action") {
    const approveUrl = c(ctx[layout.approveUrlKey ?? "approveUrl"], "#");
    const denyUrl = c(ctx[layout.denyUrlKey ?? "denyUrl"], "#");
    bodyHtml += dualActionButtons(approveUrl, denyUrl);
    const html = wrapMatchFitTransactionalHtml({ preheader, title, bodyHtml });
    return { subject, text, html };
  }

  if (layout.type === "confirm-button") {
    const confirmUrl = c(ctx[layout.confirmUrlKey ?? "confirmInviteSentUrl"], "#");
    const label = layout.confirmLabel ?? "Confirm";
    bodyHtml += confirmButtonHtml(confirmUrl, label);
    const html = wrapMatchFitTransactionalHtml({ preheader, title, bodyHtml });
    return { subject, text, html };
  }

  if (layout.type === "booking-session") {
    bodyHtml += bookingSessionExtraHtml(ctx);
    const ctaHrefKey = fields.ctaHrefKey ?? "messagesThreadUrl";
    const ctaHref = c(ctx[ctaHrefKey], "#");
    const html = wrapMatchFitTransactionalHtml({
      preheader,
      title,
      bodyHtml,
      ctaHref,
      ctaLabel: fields.ctaLabel ?? "Open Messages",
    });
    return { subject, text, html };
  }

  const ctaHrefKey = fields.ctaHrefKey ?? (layout.type === "standard" ? layout.ctaHrefKey : undefined);
  const ctaHref = ctaHrefKey ? c(ctx[ctaHrefKey], "#") : undefined;
  const html = wrapMatchFitTransactionalHtml({
    preheader,
    title,
    bodyHtml,
    ...(ctaHref && fields.ctaLabel ? { ctaHref, ctaLabel: fields.ctaLabel } : {}),
  });
  return { subject, text, html };
}
