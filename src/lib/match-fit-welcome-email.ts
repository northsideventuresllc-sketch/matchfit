import { Resend } from "resend";
import { MF_EMAIL_BRAND, matchFitEmailLogoUrl } from "@/lib/match-fit-email-brand";
import {
  escapeHtmlEmailHeroTitle,
  formatTransactionalEmailSubject,
  matchFitEmailHeroKickerHtml,
} from "@/lib/match-fit-email-shell";
import { prisma } from "@/lib/prisma";
import { sendMatchFitBrandedEmail } from "@/lib/match-fit-branded-email";
import { buildTransactionalEmail } from "@/lib/transactional-email-templates";
import { appBaseUrlForEmail, formatTransactionalEmailSubject } from "@/lib/match-fit-email-shell";
import { clientAllowsTransactionalEmailKind } from "@/lib/transactional-email-prefs";
import { parseClientNotificationPrefsJson } from "@/lib/client-notification-prefs";

const WELCOME_FROM_PRODUCTION = "Match Fit <support@match-fit.net>";

function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function appBaseUrl(): string {
  const u = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (u) return u;
  return "https://match-fit.net";
}

function buildWelcomeHtml(params: {
  heroHeadlinePlain: string;
  intendedToNote: string | null;
  dashboardHref: string;
}): string {
  const { heroHeadlinePlain, intendedToNote, dashboardHref } = params;
  const b = MF_EMAIL_BRAND;
  const logoUrl = escapeHtml(matchFitEmailLogoUrl(appBaseUrl()));
  const heroH1 = escapeHtmlEmailHeroTitle(heroHeadlinePlain);
  const note = intendedToNote
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;"><tr><td style="padding:14px 16px;background:#fffbeb;border-radius:12px;border:1px solid #fde68a;font-size:13px;line-height:1.5;color:#78350f;">${intendedToNote}</td></tr></table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light dark"/>
<meta name="supported-color-schemes" content="light dark"/>
<title>Welcome to Match Fit</title>
</head>
<body style="margin:0;padding:0;background-color:#eef1f4;background-image:linear-gradient(180deg,#fdebd5 0%,${b.cream} 38%,#eef1f4 100%);font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<span style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Your coach match starts here — open to get started.</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(51,63,72,0.08),0 20px 50px -12px rgba(51,63,72,0.14);">
<tr>
<td style="background-color:${b.navyDeep};background-image:linear-gradient(145deg,${b.navy} 0%,${b.navyHeader} 45%,${b.navyDeep} 100%);padding:36px 32px 32px;position:relative;">
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 20px;">
<tr><td style="text-align:center;">
<img src="${logoUrl}" alt="Match Fit" width="200" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;max-width:200px;height:auto;"/>
</td></tr>
</table>
${matchFitEmailHeroKickerHtml()}
<h1 style="margin:12px 0 0;font-size:28px;line-height:1.15;font-weight:800;color:#f8fafc;letter-spacing:0.06em;text-align:center;text-transform:uppercase;">${heroH1}</h1>
<p style="margin:14px 0 0;font-size:16px;line-height:1.55;color:${b.mutedOnDark};max-width:440px;margin-left:auto;margin-right:auto;text-align:center;">Your fitness journey starts with the right coach. We are glad you are here.</p>
<div style="margin:22px auto 0;height:4px;width:88px;border-radius:999px;background:linear-gradient(90deg,${b.orange},${b.red});"></div>
</td>
</tr>
<tr><td style="padding:32px 32px 8px;">
${note}
<p style="margin:0 0 18px;font-size:17px;line-height:1.65;color:${b.navy};font-weight:500;">Thanks for joining Match Fit.</p>
<p style="margin:0 0 26px;font-size:15px;line-height:1.65;color:#475569;">We built this platform so you can discover coaches who fit your goals, schedule, and training style — then book and message in one calm, focused place.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 28px;border-radius:14px;background:${b.cream};border:1px solid #e8ddd4;">
<tr><td style="padding:20px 22px;">
<p style="margin:0 0 12px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${b.olive};font-weight:700;">What you can do next</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:10px 0;border-bottom:1px solid #e8ddd4;">
<p style="margin:0;font-size:15px;line-height:1.5;color:#334155;"><span style="display:inline-block;width:8px;height:8px;margin-right:10px;border-radius:999px;background:${b.red};vertical-align:2px;"></span><strong style="color:${b.navy};">Browse coaches</strong> — profiles built for real fit, not filler.</p>
</td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #e8ddd4;">
<p style="margin:0;font-size:15px;line-height:1.5;color:#334155;"><span style="display:inline-block;width:8px;height:8px;margin-right:10px;border-radius:999px;background:${b.red};vertical-align:2px;"></span><strong style="color:${b.navy};">Book with clarity</strong> — sessions and updates in one thread.</p>
</td></tr>
<tr><td style="padding:10px 0 0;">
<p style="margin:0;font-size:15px;line-height:1.5;color:#334155;"><span style="display:inline-block;width:8px;height:8px;margin-right:10px;border-radius:999px;background:${b.red};vertical-align:2px;"></span><strong style="color:${b.navy};">Stay on track</strong> — tools that support consistency, not noise.</p>
</td></tr>
</table>
</td></tr>
</table>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 28px;">
<tr><td style="border-radius:12px;background:linear-gradient(135deg,#ff6b76 0%,${b.red} 48%,${b.redDark} 100%);box-shadow:0 10px 25px -8px rgba(230,57,70,0.45);">
<a href="${escapeHtml(dashboardHref)}" style="display:inline-block;padding:16px 32px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">Open Match Fit</a>
</td></tr>
</table>
<p style="margin:0;font-size:14px;line-height:1.55;color:#64748b;">Questions? Reply to this email — <span style="color:${b.navy};font-weight:600;">support@match-fit.net</span> is here to help.</p>
</td></tr>
<tr><td style="padding:22px 32px 32px;background:${b.cream};border-top:1px solid #e8ddd4;">
<p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">You are receiving this because a new Match Fit account was created with this email address.<br/><span style="color:${b.olive};">© Match Fit</span></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildWelcomeText(params: { greetingName: string; intendedLine: string | null; dashboardHref: string }): string {
  const blocks: string[] = [];
  if (params.intendedLine) {
    blocks.push(params.intendedLine, "");
  }
  const name = params.greetingName === "there" ? "" : `, ${params.greetingName}`;
  blocks.push(
    `Welcome to Match Fit${name}`,
    "",
    "Thanks for joining. Match Fit helps you connect with coaches who fit your goals, schedule, and style.",
    "",
    "· Browse coaches — profiles built for real fit, not filler.",
    "· Book with clarity — sessions and updates in one thread.",
    "· Stay on track — tools that support consistency, not noise.",
    "",
    `Open Match Fit: ${params.dashboardHref}`,
    "",
    "Questions? Reply to this email.",
    "",
    "— Match Fit · support@match-fit.net",
  );
  return blocks.join("\n");
}

export type SendWelcomeEmailInput = {
  to: string;
  /** Optional first name; falls back to "there" in greeting. */
  firstName?: string;
};

/**
 * Sends the new-user welcome email. Uses the shared CLIENT_WELCOME transactional template.
 * In development, mirrors Resend dev inbox routing via {@link sendMatchFitBrandedEmail} → {@link sendResendEmail}.
 */
export async function sendMatchFitWelcomeEmail(input: SendWelcomeEmailInput): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new Error("RESEND_API_KEY is not set.");
  }

  let to = input.to.trim();
  const devInbox = normalizeEmail(RESEND_DEV_INBOX);
  const intended = normalizeEmail(to);

  try {
    const clientRow = await prisma.client.findFirst({
      where: { email: { equals: intended, mode: "insensitive" } },
      select: { id: true, notificationPrefsJson: true },
    });
    if (clientRow) {
      const prefs = parseClientNotificationPrefsJson(clientRow.notificationPrefsJson);
      if (!clientAllowsTransactionalEmailKind(prefs, "CLIENT_WELCOME")) {
        return;
      }
    }
  } catch (e) {
    console.error("[Match Fit welcome email] preference check failed:", e);
  }

  const base = appBaseUrlForEmail();
  const dashboardUrl = `${base.replace(/\/$/, "")}/client`;
  const firstName = input.firstName?.trim() ? input.firstName.trim().slice(0, 80) : "there";

  const { subject: subj, text, html } = buildTransactionalEmail("CLIENT_WELCOME", {
    firstName,
    dashboardUrl,
  });
  const subject = formatTransactionalEmailSubject(subj);

  if (process.env.NODE_ENV === "development" && intended !== devInbox) {
    to = RESEND_DEV_INBOX;
  }

  const from = process.env.NODE_ENV === "development" ? RESEND_ONBOARDING_FROM : WELCOME_FROM_PRODUCTION;
  const rawFirst = input.firstName?.trim().replace(/\s+/g, " ").slice(0, 80);
  const heroHeadlinePlain = rawFirst && rawFirst.length > 0 ? `Welcome, ${rawFirst}` : "Welcome aboard";
  const openHref = appBaseUrl();
  const dashboardHref = `${openHref}/client`;

  const subject = formatTransactionalEmailSubject("Welcome to Match Fit");
  const html = buildWelcomeHtml({ heroHeadlinePlain, intendedToNote, dashboardHref });
  const textGreeting =
    input.firstName?.trim() ? input.firstName.trim().slice(0, 80).replace(/\s+/g, " ") : "there";
  const text = buildWelcomeText({
    greetingName: textGreeting,
    intendedLine: intendedLine,
    dashboardHref,
  });

  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from,
    to: [to],
    subject,
    text,
    html,
    replyTo: process.env.NODE_ENV === "development" ? undefined : "support@match-fit.net",
  });
}
