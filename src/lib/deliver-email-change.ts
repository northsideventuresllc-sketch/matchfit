/**
 * Transactional email for confirming a new address on the account.
 * Uses Resend when RESEND_API_KEY is set; otherwise logs in development.
 */

import { RESEND_ONBOARDING_FROM, sendResendEmail } from "@/lib/resend-client";

export async function deliverEmailChangeConfirmation(params: {
  toEmail: string;
  confirmUrl: string;
}): Promise<void> {
  const { toEmail, confirmUrl } = params;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "development") {
      console.info(`[Match Fit][email change confirm] to ${toEmail}: ${confirmUrl}`);
      return;
    }
    throw new Error("RESEND_API_KEY must be set to send email change confirmation in production.");
  }

  const text = `Confirm this email address for your Match Fit account by opening this link (valid for 1 hour):\n\n${confirmUrl}\n\nIf you did not request this change, you can ignore this email.`;

  await sendResendEmail({
    from: RESEND_ONBOARDING_FROM,
    to: toEmail,
    subject: "Confirm your new Match Fit email",
    text,
  });
}

export async function deliverEmailChangeSecurityNotice(params: {
  toEmail: string;
  newEmail: string;
}): Promise<void> {
  const { toEmail, newEmail } = params;
  const key = process.env.RESEND_API_KEY;
  const bodyText = `Someone started a change to use ${newEmail} as the email on your Match Fit account.\n\nIf this was you, you will need to confirm the new address from that inbox.\n\nIf this was not you, change your password from Account Settings and contact support if you are concerned.`;
  if (!key) {
    if (process.env.NODE_ENV === "development") {
      console.info(`[Match Fit][email change notice] to ${toEmail}: ${bodyText}`);
      return;
    }
    throw new Error("RESEND_API_KEY must be set to send security notices in production.");
  }

  await sendResendEmail({
    from: RESEND_ONBOARDING_FROM,
    to: toEmail,
    subject: "Match Fit email change requested",
    text: bodyText,
  });
}
