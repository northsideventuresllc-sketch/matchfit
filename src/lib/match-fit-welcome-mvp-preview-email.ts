import { Resend } from "resend";
import { MF_EMAIL_SITE, matchFitEmailLogoUrl } from "@/lib/match-fit-email-brand";
import { matchFitEmailHeroKickerHtml } from "@/lib/match-fit-email-shell";
import {
  MATCH_FIT_REPLY_TO,
  RESEND_DEV_INBOX,
  RESEND_ONBOARDING_FROM,
  matchFitProductionFromHeader,
} from "@/lib/resend-client";

/** Default recipient for internal welcome / Resend checks (see {@link RESEND_DEV_INBOX}). */
export const MVP_WELCOME_TEST_RECIPIENT = RESEND_DEV_INBOX;

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

function buildMvpWelcomeHtml(dashboardHref: string): string {
  const href = escapeHtml(dashboardHref);
  const logoUrl = escapeHtml(matchFitEmailLogoUrl(appBaseUrl()));
  const s = MF_EMAIL_SITE;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="dark"/>
<meta name="supported-color-schemes" content="dark"/>
<title>Welcome — Match Fit</title>
</head>
<body style="margin:0;padding:0;background-color:${s.bg};font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<span style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Your Match Fit account is ready — open the app to connect with coaches and manage your training.</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${s.bg};background-image:${s.outerBgGradient};padding:48px 16px 56px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;border-radius:16px;overflow:hidden;border:1px solid ${s.border};background-color:${s.panel};box-shadow:0 24px 60px rgba(0,0,0,0.45);">
<tr>
<td align="center" style="padding:0;margin:0;background-color:${s.panel};background-image:linear-gradient(180deg,#1a1410 0%,${s.panel} 45%,${s.panel} 100%);border-bottom:1px solid ${s.border};">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr>
<td align="center" style="padding:40px 28px 32px;text-align:center;">
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 20px;">
<tr><td align="center" style="text-align:center;">
<img src="${logoUrl}" alt="Match Fit" width="200" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;max-width:200px;height:auto;"/>
</td></tr>
</table>
${matchFitEmailHeroKickerHtml()}
<h1 style="margin:0;font-size:30px;line-height:1.15;font-weight:800;color:${s.textPrimary};letter-spacing:0.06em;text-align:center;text-transform:uppercase;">WELCOME TO MATCH FIT</h1>
<p style="margin:18px auto 0;max-width:480px;font-size:16px;line-height:1.65;font-weight:400;color:${s.textMuted};text-align:center;">Match Fit connects you with coaches who fit your goals and schedule—then keeps booking and messaging in one focused place.</p>
<div style="margin:26px auto 0;height:3px;width:100%;max-width:240px;border-radius:999px;background:linear-gradient(90deg,${s.gold},${s.orange},${s.red});"></div>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td align="center" style="padding:32px 28px 36px;text-align:center;background-color:${s.panel};">
<p style="margin:0 auto 20px;max-width:480px;font-size:15px;line-height:1.7;color:${s.textMuted};text-align:center;">Whether you are just getting started or leveling up, you have a clear home base for finding the right coach and staying on track week to week.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;border:1px solid ${s.border};background-color:${s.bg};border-radius:12px;">
<tr><td align="center" style="padding:22px 20px;text-align:center;">
<p style="margin:0 0 16px;font-size:11px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:${s.orange};text-align:center;">WHAT YOU CAN DO NEXT</p>
<p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:${s.textPrimary};text-align:center;"><span style="color:${s.red};font-weight:800;">01</span> Find coaches that align with your goals, availability, and how you like to train.</p>
<p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:${s.textPrimary};text-align:center;"><span style="color:${s.red};font-weight:800;">02</span> Book sessions and keep your plans organized in one straightforward place.</p>
<p style="margin:0;font-size:15px;line-height:1.65;color:${s.textPrimary};text-align:center;"><span style="color:${s.red};font-weight:800;">03</span> Message your coach and stay consistent with less friction.</p>
</td></tr>
</table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 28px;">
<tr><td align="center" style="text-align:center;">
<table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto;">
<tr>
<td align="center" style="border-radius:12px;background:linear-gradient(135deg,${s.gold} 0%,${s.orange} 52%,${s.red} 100%);">
<a href="${href}" style="display:inline-block;padding:16px 36px;font-size:13px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:${s.ctaText};text-decoration:none;">OPEN MATCH FIT</a>
</td>
</tr>
</table>
</td></tr>
</table>
<p style="margin:0;font-size:13px;line-height:1.65;color:${s.textMuted};text-align:center;"><span style="font-weight:800;color:${s.textPrimary};letter-spacing:0.06em;">DIRECT LINE:</span> <a href="mailto:support@match-fit.net" style="color:${s.orange};text-decoration:none;font-weight:700;">support@match-fit.net</a></p>
</td>
</tr>
<tr>
<td align="center" style="padding:22px 28px 28px;border-top:1px solid ${s.border};background-color:${s.bg};text-align:center;">
<p style="margin:0;font-size:11px;line-height:1.7;color:${s.textMuted};text-align:center;">© 2026 Northside Ventures Group LLC (DBA: Northside Intellegence).</p>
</td>
</tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildMvpWelcomeText(dashboardHref: string): string {
  return [
    "WELCOME TO MATCH FIT",
    "",
    "PRIVATE COACHING MARKETPLACE",
    "",
    "Match Fit connects you with coaches who fit your goals and schedule—then keeps booking and messaging in one focused place.",
    "",
    "WHAT YOU CAN DO NEXT",
    "",
    "01 · Find coaches that align with your goals, availability, and how you like to train.",
    "02 · Book sessions and keep your plans organized in one straightforward place.",
    "03 · Message your coach and stay consistent with less friction.",
    "",
    `OPEN MATCH FIT: ${dashboardHref}`,
    "",
    "DIRECT LINE: support@match-fit.net",
    "",
    "© 2026 Northside Ventures Group LLC (DBA: Northside Intellegence).",
  ].join("\n");
}

/**
 * Sends a branded welcome email from the verified Match Fit domain via Resend.
 */
export async function sendMatchFitWelcomeMvpPreviewEmail(): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new Error("RESEND_API_KEY is not set.");
  }

  const to = MVP_WELCOME_TEST_RECIPIENT;
  const openHref = appBaseUrl();
  const dashboardHref = `${openHref}/client`;
  const subject = "Welcome to Match Fit";

  const resend = new Resend(key);
  const from =
    process.env.NODE_ENV === "development" ? RESEND_ONBOARDING_FROM : matchFitProductionFromHeader();

  const { error } = await resend.emails.send({
    from,
    to: [to],
    subject,
    html: buildMvpWelcomeHtml(dashboardHref),
    text: buildMvpWelcomeText(dashboardHref),
    replyTo: MATCH_FIT_REPLY_TO,
  });

  if (error) {
    const msg =
      typeof error === "object" && error && "message" in error && typeof (error as { message: unknown }).message === "string"
        ? (error as { message: string }).message
        : "Resend rejected the email.";
    const sc =
      typeof error === "object" &&
      error &&
      "statusCode" in error &&
      typeof (error as { statusCode: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 422;
    throw new Error(`Resend HTTP ${sc}: ${msg}`);
  }
}
