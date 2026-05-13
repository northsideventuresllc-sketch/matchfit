# Match Fit — `/api/send-welcome` code bundle (for review / analysis)

**Purpose:** Single downloadable document containing the Next.js API route and related modules that send the branded welcome email (Resend, `support@match-fit.net`).

**How to download:** With the app running, open `http://localhost:3000/download-send-welcome-analysis` (or the same path on your deployed host) and click **Download .md file** — your browser saves `MATCH-FIT-SEND-WELCOME-CODE-FOR-ANALYSIS.md` locally. You can also right-click this file in the editor → **Reveal in Finder** (macOS), or print to PDF from a Markdown preview.

**Runtime:** Requires `RESEND_API_KEY`. Optional `MATCHFIT_SEND_WELCOME_PREVIEW_SECRET` (production). `NEXT_PUBLIC_APP_URL` for absolute logo and CTA links.

**Static asset:** Email HTML references `{appBaseUrl}/logo.png` (`public/logo.png`).

---

## 1. `src/app/api/send-welcome/route.ts`

```typescript
import {
  MVP_WELCOME_TEST_RECIPIENT,
  sendMatchFitWelcomeMvpPreviewEmail,
} from "@/lib/match-fit-welcome-mvp-preview-email";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isSendWelcomeAllowed(req: Request): boolean {
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  const secret = process.env.MATCHFIT_SEND_WELCOME_PREVIEW_SECRET?.trim();
  if (!secret || secret.length < 16) {
    return false;
  }
  const auth = req.headers.get("authorization")?.trim();
  const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  return bearer === secret;
}

/**
 * POST — sends a branded welcome email from support@match-fit.net (Resend).
 * Recipient is the configured internal inbox. Local: no auth. Production: set MATCHFIT_SEND_WELCOME_PREVIEW_SECRET and send Authorization: Bearer <secret>.
 */
export async function POST(req: Request) {
  try {
    if (!isSendWelcomeAllowed(req)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    await sendMatchFitWelcomeMvpPreviewEmail();

    return NextResponse.json({
      ok: true,
      to: MVP_WELCOME_TEST_RECIPIENT,
      message: "Welcome email sent.",
    });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not send welcome email.", {
      logLabel: "[Match Fit send-welcome]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
```

---

## 2. `src/lib/match-fit-welcome-mvp-preview-email.ts`

```typescript
import { Resend } from "resend";
import { MF_EMAIL_SITE, matchFitEmailLogoUrl } from "@/lib/match-fit-email-brand";
import { RESEND_DEV_INBOX } from "@/lib/resend-client";

const FROM_BRANDED = "Match Fit <support@match-fit.net>";

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
<p style="margin:0 0 14px;font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:${s.orange};text-align:center;">THE PERFECT MATCH FOR YOUR FITNESS JOURNEY</p>
<p style="margin:0 0 28px;font-size:12px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:${s.textMuted};text-align:center;">PRIVATE COACHING MARKETPLACE</p>
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
 * Sends a branded welcome email from Match Fit &lt;support@match-fit.net&gt; via Resend (domain must be verified).
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
  const { error } = await resend.emails.send({
    from: FROM_BRANDED,
    to: [to],
    subject,
    html: buildMvpWelcomeHtml(dashboardHref),
    text: buildMvpWelcomeText(dashboardHref),
    replyTo: "support@match-fit.net",
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
```

---

## 3. `src/lib/match-fit-email-brand.ts`

```typescript
/**
 * Match Fit transactional email palette — aligned with `public/logo.png`
 * (navy wordmark, red “Fit”, warm orange / olive in the mark).
 */
export const MF_EMAIL_BRAND = {
  navy: "#333F48",
  navyDeep: "#1c2430",
  navyHeader: "#252f38",
  red: "#E63946",
  redDark: "#c62f3a",
  orange: "#F4A261",
  orangeMid: "#F2994A",
  olive: "#606C38",
  cream: "#FDF8F3",
  mutedOnDark: "#b8c0c8",
  borderDark: "#2a3540",
} as const;

export function matchFitEmailLogoUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/logo.png`;
}

/**
 * Homepage / app UI — dark canvas, gold → orange → red accents (`src/app/page.tsx`, auth shells).
 * Use for transactional HTML that should match the live product.
 */
export const MF_EMAIL_SITE = {
  bg: "#0B0C0F",
  panel: "#0E1016",
  gold: "#FFD34E",
  orange: "#FF7E00",
  red: "#E32B2B",
  textPrimary: "#F4F6FA",
  textMatch: "#E8EAEF",
  textMuted: "#9CA3AF",
  border: "#262a33",
  /** Dark burnt-orange into site canvas */
  outerBgGradient:
    "linear-gradient(180deg,#5c3014 0%,#3d1f0c 22%,#241308 48%,#120a05 72%,#0B0C0F 100%)",
  ctaText: "#0B0C0F",
} as const;
```

---

## 4. `src/lib/resend-client.ts` (full — shared Resend helpers; welcome uses `RESEND_DEV_INBOX`)

```typescript
/**
 * Resend HTTP API helpers. OTP and system mail use Resend's onboarding sender unless you
 * verify a custom domain and change this module.
 */

/** Required sender for unverified domains on Resend free tier. */
export const RESEND_ONBOARDING_FROM = "onboarding@resend.dev";

/**
 * Hard-coded development inbox. In `NODE_ENV === "development"`, all outbound Resend email
 * is forced To this address so Resend never rejects unverified recipients; the real
 * intended address is prefixed in the message body.
 */
export const RESEND_DEV_INBOX = "northside.ventures.llc@gmail.com";

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

/**
 * Sends one transactional email via Resend.
 *
 * Development safety (NODE_ENV === "development" only):
 * - `from` is always {@link RESEND_ONBOARDING_FROM}
 * - `to` is always {@link RESEND_DEV_INBOX} unless it already equals that inbox
 * - If redirected, the body is prefixed with the intended recipient
 */
export async function sendResendEmail(params: {
  subject: string;
  text: string;
  to: string;
  /** Ignored in development (always onboarding sender). */
  from?: string;
  html?: string;
  replyTo?: string;
}): Promise<string | undefined> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("RESEND_API_KEY is not set.");
  }

  let to = params.to.trim();
  let text = params.text;
  let html = params.html;
  let from = (params.from ?? RESEND_ONBOARDING_FROM).trim();

  if (process.env.NODE_ENV === "development") {
    from = RESEND_ONBOARDING_FROM;
    const devInbox = normalizeEmail(RESEND_DEV_INBOX);
    const intended = normalizeEmail(to);
    if (intended !== devInbox) {
      text = `Development safety — intended recipient: ${params.to.trim()}\n\n${text}`;
      if (html) {
        html = `<p><strong>Development safety — intended recipient:</strong> ${escapeHtml(params.to.trim())}</p>${html}`;
      }
      to = RESEND_DEV_INBOX;
    }
  }

  const payload: Record<string, unknown> = {
    from,
    to,
    subject: params.subject,
    text,
  };
  if (html) {
    payload.html = html;
  }
  if (params.replyTo?.trim()) {
    payload.reply_to = params.replyTo.trim();
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Resend HTTP ${res.status}: ${raw}`);
  }
  try {
    const parsed = JSON.parse(raw) as { id?: string };
    return typeof parsed.id === "string" ? parsed.id : undefined;
  } catch {
    return undefined;
  }
}

/** Map `Resend HTTP …` errors from {@link sendResendEmail} to an HTTP status for API routes. */
export function httpStatusFromResendError(message: string): number {
  const m = message.match(/Resend HTTP (\d+)/);
  if (!m) return 500;
  const code = Number(m[1]);
  if (code === 401 || code === 403) return 403;
  if (code === 422) return 422;
  if (code >= 400 && code < 500) return code;
  return 500;
}
```

---

## 5. Related (error mapping only)

The route imports `publicApiErrorFromUnknown` from `src/lib/public-api-error.ts`, which maps Resend-style errors to HTTP status codes via `httpStatusFromResendError`. Open that file in the repo if you need the full implementation.

---

*This bundle mirrors the repository as a convenience copy; the canonical source of truth remains the `.ts` files under `src/`.*
