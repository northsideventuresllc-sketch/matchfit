import { MF_EMAIL_SITE, matchFitEmailLogoUrl } from "@/lib/match-fit-email-brand";

export function escapeHtmlEmail(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function appBaseUrlForEmail(): string {
  const u = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (u) return u;
  return "https://match-fit.net";
}

/**
 * Normalizes outbound email subject lines: trims ends and collapses repeat whitespace.
 * Subjects must read like natural copy — write sentence-style phrasing and intentional
 * capitalization in templates; do not machine-uppercase entire subjects.
 */
export function formatTransactionalEmailSubject(subject: string): string {
  return subject.trim().replace(/\s+/g, " ");
}

/**
 * Shared Match Fit transactional HTML shell (dark canvas + gold/orange accents).
 *
 * Conventions for new templates: pass `title` in normal sentence case in code; the hero
 * heading is always shown in **ALL CAPS** (white `textPrimary`) with tight tracking. Run
 * final subjects through {@link formatTransactionalEmailSubject} for whitespace only.
 * Match body copy tone to existing templates; use the `bodyParagraphs` pattern in
 * `transactional-email-templates.ts` and MF_EMAIL_SITE tokens for colors.
 */
export function wrapMatchFitTransactionalHtml(params: {
  preheader: string;
  /** Shown in the hero as ALL CAPS (write in sentence case in source if you prefer). */
  title: string;
  bodyHtml: string;
  /** Optional primary button */
  ctaHref?: string;
  ctaLabel?: string;
}): string {
  const s = MF_EMAIL_SITE;
  const logoUrl = escapeHtmlEmail(matchFitEmailLogoUrl(appBaseUrlForEmail()));
  const title = escapeHtmlEmail(params.title.trim().toUpperCase());
  const pre = escapeHtmlEmail(params.preheader);
  const cta =
    params.ctaHref && params.ctaLabel
      ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:28px 0 0;"><tr><td align="center"><table role="presentation" cellspacing="0" cellpadding="0" align="center"><tr><td style="border-radius:12px;background:linear-gradient(135deg,${s.gold} 0%,${s.orange} 52%,${s.red} 100%);"><a href="${escapeHtmlEmail(params.ctaHref)}" style="display:inline-block;padding:14px 28px;font-size:13px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${s.ctaText};text-decoration:none;">${escapeHtmlEmail(params.ctaLabel)}</a></td></tr></table></td></tr></table>`
      : "";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="dark"/><title>${title}</title></head>
<body style="margin:0;padding:0;background-color:${s.bg};font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<span style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${pre}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${s.bg};background-image:${s.outerBgGradient};padding:40px 16px 48px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-radius:16px;overflow:hidden;border:1px solid ${s.border};background-color:${s.panel};">
<tr><td align="center" style="padding:32px 24px 20px;text-align:center;border-bottom:1px solid ${s.border};">
<img src="${logoUrl}" alt="Match Fit" width="160" style="display:block;margin:0 auto;border:0;max-width:160px;height:auto;"/>
<p style="margin:16px 0 0;font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:${s.orange};text-align:center;">MATCH FIT</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.2;font-weight:800;color:${s.textPrimary};text-align:center;letter-spacing:0.06em;text-transform:uppercase;">${title}</h1>
</td></tr>
<tr><td align="center" style="padding:24px 24px 28px;text-align:center;">
${params.bodyHtml}
${cta}
<p style="margin:28px 0 0;font-size:11px;line-height:1.65;color:${s.textMuted};text-align:center;">© ${new Date().getFullYear()} Northside Ventures Group LLC (DBA: Northside Intellegence).</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}
