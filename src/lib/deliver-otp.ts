/**
 * Sends one-time codes for 2FA. Match Fit uses Resend for email when RESEND_API_KEY is set;
 * otherwise codes are logged server-side in development.
 *
 * **SMS / voice:** In production, Twilio is used when `TWILIO_*` env vars are set. In development,
 * SMS and voice are **mocked** by default: nothing is sent; the 6-digit code is printed to the
 * server terminal and the same hash/verify flow runs as in production. Set `MATCH_FIT_USE_TWILIO_IN_DEV=true`
 * to exercise real Twilio from a dev server. Set `MATCH_FIT_MOCK_PHONE_OTP=true` to force the
 * same mock in any environment (hosted beta).
 *
 * Email OTPs use `sendResendEmail` (dev inbox redirect in `resend-client.ts`).
 */

import { RESEND_ONBOARDING_FROM, sendResendEmail } from "@/lib/resend-client";

export type OtpChannel = "EMAIL" | "SMS" | "VOICE";

/** When true, the SMS/voice path was mocked (terminal log only); clients may show a dev hint. */
export type DeliverSignupOtpResult = { devPhoneMock?: boolean };

function isRealTwilioEnabledInDevelopment(): boolean {
  const v = process.env.MATCH_FIT_USE_TWILIO_IN_DEV?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

function forcePhoneOtpMockEverywhere(): boolean {
  const v = process.env.MATCH_FIT_MOCK_PHONE_OTP?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

/**
 * When true, SMS/VOICE OTPs are not sent via Twilio; the code is logged for local/beta testing.
 */
export function shouldMockSmsVoiceOtp(): boolean {
  if (forcePhoneOtpMockEverywhere()) return true;
  if (process.env.NODE_ENV === "development" && !isRealTwilioEnabledInDevelopment()) return true;
  return false;
}

function logDevPhoneMockOtp(channel: OtpChannel, phone: string): void {
  const line = "─".repeat(56);
  console.info(`\n${line}`);
  console.info(` Match Fit — DEV MOCK ${channel} (no Twilio send)`);
  console.info(` Intended destination: ${phone}`);
  console.info(` OTP issued (value not logged — use dev UI hint or non-production delivery).`);
  console.info(`${line}\n`);
}

export async function deliverSignupOtp(
  channel: OtpChannel,
  params: { email: string; phone: string; code: string },
): Promise<DeliverSignupOtpResult> {
  const { email, phone, code } = params;

  if (channel === "EMAIL") {
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

    const body = `Your verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you did not try to sign in, ignore this message.`;

    await sendResendEmail({
      from: RESEND_ONBOARDING_FROM,
      to: email,
      subject: "Your Match Fit verification code",
      text: body,
    });
    return {};
  }

  if (shouldMockSmsVoiceOtp()) {
    logDevPhoneMockOtp(channel, phone);
    return { devPhoneMock: true };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromNum = process.env.TWILIO_FROM_NUMBER;
  if (sid && token && fromNum) {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const body = new URLSearchParams({
      To: phone,
      From: fromNum,
      Body: channel === "SMS" ? `Match Fit code: ${code}` : `Your Match Fit code is ${code}.`,
    });
    const url =
      channel === "SMS"
        ? `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`
        : `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body:
        channel === "SMS"
          ? body
          : new URLSearchParams({
              To: phone,
              From: fromNum,
              Twiml: `<Response><Say>Your Match Fit code is ${code.split("").join(" ")}</Say></Response>`,
            }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Phone delivery failed: ${t}`);
    }
    return {};
  }

  throw new Error(
    "Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER to send SMS or voice codes in production.",
  );
}
