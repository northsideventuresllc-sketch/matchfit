import { prisma } from "@/lib/prisma";
import { sendMatchFitBrandedEmail } from "@/lib/match-fit-branded-email";
import { buildTransactionalEmail } from "@/lib/transactional-email-templates";
import { appBaseUrlForEmail, formatTransactionalEmailSubject } from "@/lib/match-fit-email-shell";
import { clientAllowsTransactionalEmailKind } from "@/lib/transactional-email-prefs";
import { parseClientNotificationPrefsJson } from "@/lib/client-notification-prefs";
import { RESEND_DEV_INBOX } from "@/lib/resend-client";

function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

export type SendWelcomeEmailInput = {
  to: string;
  /** Optional first name; falls back to "there" in greeting. */
  firstName?: string;
};

/**
 * Sends the new-user welcome email. Uses the shared CLIENT_WELCOME transactional template.
 * In development, mirrors Resend dev inbox routing via {@link sendMatchFitBrandedEmail} → {@link sendResendEmail}.
 */
export async function sendMatchFitWelcomeEmail(input: SendWelcomeEmailInput): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new Error("RESEND_API_KEY is not set.");
  }

  let to = input.to.trim();
  const devInbox = normalizeEmail(RESEND_DEV_INBOX);
  const intended = normalizeEmail(to);

  try {
    const clientRow = await prisma.client.findFirst({
      where: { email: { equals: intended, mode: "insensitive" } },
      select: { id: true, notificationPrefsJson: true },
    });
    if (clientRow) {
      const prefs = parseClientNotificationPrefsJson(clientRow.notificationPrefsJson);
      if (!clientAllowsTransactionalEmailKind(prefs, "CLIENT_WELCOME")) {
        return;
      }
    }
  } catch (e) {
    console.error("[Match Fit welcome email] preference check failed:", e);
  }

  const base = appBaseUrlForEmail();
  const dashboardUrl = `${base.replace(/\/$/, "")}/client`;
  const firstName = input.firstName?.trim() ? input.firstName.trim().slice(0, 80) : "there";

  const { subject: subj, text, html } = buildTransactionalEmail("CLIENT_WELCOME", {
    firstName,
    dashboardUrl,
  });
  const subject = formatTransactionalEmailSubject(subj);

  if (process.env.NODE_ENV === "development" && intended !== devInbox) {
    to = RESEND_DEV_INBOX;
  }

  await sendMatchFitBrandedEmail({
    to,
    subject,
    text,
    html,
    replyTo: process.env.NODE_ENV === "development" ? undefined : "support@match-fit.net",
  });
}
