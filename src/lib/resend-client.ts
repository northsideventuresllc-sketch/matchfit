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
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("RESEND_API_KEY is not set.");
  }

  let to = params.to.trim();
  let text = params.text;
  let from = (params.from ?? RESEND_ONBOARDING_FROM).trim();

  if (process.env.NODE_ENV === "development") {
    from = RESEND_ONBOARDING_FROM;
    const devInbox = normalizeEmail(RESEND_DEV_INBOX);
    const intended = normalizeEmail(to);
    if (intended !== devInbox) {
      text = `Development safety — intended recipient: ${params.to.trim()}\n\n${text}`;
      to = RESEND_DEV_INBOX;
    }
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: params.subject,
      text,
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Resend HTTP ${res.status}: ${raw}`);
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
