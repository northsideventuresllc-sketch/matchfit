/**
 * Email one-time codes (2FA enrollment, password-change OTP when not using the PKCE email link flow, etc.).
 * SMS and voice are no longer supported; any legacy `"SMS"` / `"VOICE"` channel value is delivered by email instead.
 *
 * Login and resend flows use {@link send2FACode} in `auth-2fa-email.ts` (PKCE-aligned email storage) — unchanged.
 */

import { sendTransactionalEmailIfAllowed } from "@/lib/transactional-email-send";

export type OtpChannel = "EMAIL" | "SMS" | "VOICE";

export type DeliverSignupOtpResult = Record<string, never>;

export async function deliverSignupOtp(
  channel: OtpChannel,
  params: { email: string; phone: string; code: string; clientId?: string; trainerId?: string },
): Promise<DeliverSignupOtpResult> {
  const { email, code } = params;
  void channel;

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "development") {
      console.info(
        `[Match Fit 2FA][EMAIL] (no RESEND_API_KEY) intended for ${email} — OTP issued, not logged (set RESEND_API_KEY for real delivery).`,
      );
      return {};
    }
    throw new Error("RESEND_API_KEY must be set to send email codes in production.");
  }

  await sendTransactionalEmailIfAllowed({
    kind: "OTP_2FA",
    to: email.trim(),
    audience: params.trainerId ? "TRAINER" : "CLIENT",
    clientId: params.clientId,
    trainerId: params.trainerId,
    variables: { code },
  });
  return {};
}
