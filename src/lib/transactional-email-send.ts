import { prisma } from "@/lib/prisma";
import { parseClientNotificationPrefsJson } from "@/lib/client-notification-prefs";
import { parseTrainerNotificationPrefsJson } from "@/lib/trainer-notification-prefs";
import { sendMatchFitBrandedEmail } from "@/lib/match-fit-branded-email";
import { MATCH_FIT_REPLY_TO } from "@/lib/resend-client";
import { buildTransactionalEmailWithOverrides } from "@/lib/transactional-email-template-store";
import type { TransactionalEmailKind } from "@/lib/transactional-email-kinds";
import { isMandatoryTransactionalEmailKind } from "@/lib/transactional-email-kinds";
import { clientAllowsTransactionalEmailKind, trainerAllowsTransactionalEmailKind } from "@/lib/transactional-email-prefs";
import { logTransactionalEmailDelivery } from "@/lib/transactional-email-delivery-log";

export type SendTransactionalEmailAudience = "CLIENT" | "TRAINER" | "STAFF";

export type SendTransactionalEmailParams = {
  kind: TransactionalEmailKind;
  to: string;
  audience: SendTransactionalEmailAudience;
  /** When set, optional emails respect dashboard toggles. */
  clientId?: string | null;
  trainerId?: string | null;
  variables: Record<string, string>;
};

export type SendTransactionalEmailResult =
  | { sent: true }
  | { sent: false; skipped: "prefs" }
  | { sent: false; skipped: "no_recipient" };

/**
 * Sends a branded transactional email when allowed by user preferences (or mandatory).
 */
export async function sendTransactionalEmailIfAllowed(params: SendTransactionalEmailParams): Promise<SendTransactionalEmailResult> {
  const to = params.to?.trim();
  const { subject } = await buildTransactionalEmailWithOverrides(params.kind, params.variables);

  if (!to) {
    void logTransactionalEmailDelivery({
      kind: params.kind,
      audience: params.audience,
      toEmail: "",
      subject,
      status: "skipped_no_recipient",
      clientId: params.clientId,
      trainerId: params.trainerId,
    });
    return { sent: false, skipped: "no_recipient" };
  }

  if (!isMandatoryTransactionalEmailKind(params.kind) && params.audience !== "STAFF") {
    if (params.audience === "CLIENT" && params.clientId) {
      const row = await prisma.client.findUnique({
        where: { id: params.clientId },
        select: { notificationPrefsJson: true },
      });
      const prefs = parseClientNotificationPrefsJson(row?.notificationPrefsJson);
      if (!clientAllowsTransactionalEmailKind(prefs, params.kind)) {
        void logTransactionalEmailDelivery({
          kind: params.kind,
          audience: params.audience,
          toEmail: to,
          subject,
          status: "skipped_prefs",
          clientId: params.clientId,
          trainerId: params.trainerId,
        });
        return { sent: false, skipped: "prefs" };
      }
    }
    if (params.audience === "TRAINER" && params.trainerId) {
      const row = await prisma.trainer.findUnique({
        where: { id: params.trainerId },
        select: { notificationPrefsJson: true },
      });
      const prefs = parseTrainerNotificationPrefsJson(row?.notificationPrefsJson);
      if (!trainerAllowsTransactionalEmailKind(prefs, params.kind)) {
        void logTransactionalEmailDelivery({
          kind: params.kind,
          audience: params.audience,
          toEmail: to,
          subject,
          status: "skipped_prefs",
          clientId: params.clientId,
          trainerId: params.trainerId,
        });
        return { sent: false, skipped: "prefs" };
      }
    }
  }

  const { text, html } = await buildTransactionalEmailWithOverrides(params.kind, params.variables);
  try {
    const resendId = await sendMatchFitBrandedEmail({
      to,
      subject,
      text,
      html,
      replyTo: params.audience === "STAFF" ? undefined : MATCH_FIT_REPLY_TO,
    });
    void logTransactionalEmailDelivery({
      kind: params.kind,
      audience: params.audience,
      toEmail: to,
      subject,
      status: "sent",
      resendId,
      clientId: params.clientId,
      trainerId: params.trainerId,
    });
    return { sent: true };
  } catch (e) {
    void logTransactionalEmailDelivery({
      kind: params.kind,
      audience: params.audience,
      toEmail: to,
      subject,
      status: "failed",
      errorMessage: e instanceof Error ? e.message : String(e),
      clientId: params.clientId,
      trainerId: params.trainerId,
    });
    throw e;
  }
}
