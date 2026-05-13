/**
 * Transactional email for confirming a new address on the account.
 * Uses Resend when RESEND_API_KEY is set; otherwise logs in development.
 */

import { sendTransactionalEmailIfAllowed } from "@/lib/transactional-email-send";

export async function deliverEmailChangeConfirmation(params: {
  toEmail: string;
  confirmUrl: string;
  clientId: string;
}): Promise<void> {
  const { toEmail, confirmUrl, clientId } = params;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "development") {
      console.info(`[Match Fit][email change confirm] to ${toEmail}: ${confirmUrl}`);
      return;
    }
    throw new Error("RESEND_API_KEY must be set to send email change confirmation in production.");
  }

  await sendTransactionalEmailIfAllowed({
    kind: "EMAIL_CHANGE_CONFIRM",
    to: toEmail.trim(),
    audience: "CLIENT",
    clientId,
    variables: { confirmUrl },
  });
}

export async function deliverEmailChangeSecurityNotice(params: {
  toEmail: string;
  newEmail: string;
  clientId: string;
}): Promise<void> {
  const { toEmail, newEmail, clientId } = params;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "development") {
      console.info(`[Match Fit][email change notice] to ${toEmail}: new=${newEmail}`);
      return;
    }
    throw new Error("RESEND_API_KEY must be set to send security notices in production.");
  }

  await sendTransactionalEmailIfAllowed({
    kind: "EMAIL_CHANGE_SECURITY",
    to: toEmail.trim(),
    audience: "CLIENT",
    clientId,
    variables: { newEmail },
  });
}
