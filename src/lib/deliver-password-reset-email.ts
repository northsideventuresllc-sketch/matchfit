/**
 * Sends a password reset link. Uses Resend when RESEND_API_KEY is set; otherwise logs in development.
 */

import { RESEND_ONBOARDING_FROM, sendResendEmail } from "@/lib/resend-client";

export async function deliverPasswordResetEmail(params: { email: string; resetUrl: string }): Promise<void> {
  const { email, resetUrl } = params;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "development") {
      console.info(`[Match Fit][password reset] to ${email}: ${resetUrl}`);
      return;
    }
    throw new Error("RESEND_API_KEY must be set to send password reset email in production.");
  }

  const text = `We received a request to change the password for your Match Fit account.\n\nOpen this link (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`;

  await sendResendEmail({
    from: RESEND_ONBOARDING_FROM,
    to: email,
    subject: "Reset your Match Fit password",
    text,
  });
}
