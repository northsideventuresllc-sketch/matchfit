/**
 * Sends a password reset link. Uses Resend when RESEND_API_KEY is set; otherwise logs in development.
 */

import { prisma } from "@/lib/prisma";
import { sendTransactionalEmailIfAllowed } from "@/lib/transactional-email-send";

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

  const norm = email.trim().toLowerCase();
  const [clientRow, trainerRow] = await Promise.all([
    prisma.client.findFirst({ where: { email: { equals: norm, mode: "insensitive" } }, select: { id: true } }),
    prisma.trainer.findFirst({ where: { email: { equals: norm, mode: "insensitive" } }, select: { id: true } }),
  ]);

  await sendTransactionalEmailIfAllowed({
    kind: "PASSWORD_RESET",
    to: email.trim(),
    audience: clientRow ? "CLIENT" : "TRAINER",
    clientId: clientRow?.id,
    trainerId: trainerRow?.id,
    variables: { resetUrl },
  });
}
