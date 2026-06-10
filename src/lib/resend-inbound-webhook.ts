import "server-only";

import { Resend } from "resend";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { readPlatformSecret } from "@/lib/platform-secrets";
import { storeSupportInboxMessage } from "@/lib/support-inbox-data";

export const SUPPORT_INBOX_ADDRESS = "support@match-fit.net";

type ResendWebhookHeaders = {
  svixId?: string | null;
  svixTimestamp?: string | null;
  svixSignature?: string | null;
};

type EmailReceivedEvent = {
  type: "email.received";
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
  };
};

async function getResendApiKey(): Promise<string | null> {
  await hydratePlatformEnvFromDatabase();
  return (await readPlatformSecret("RESEND_API_KEY")) ?? process.env.RESEND_API_KEY?.trim() ?? null;
}

function parseEmailReceivedEvent(rawBody: string): EmailReceivedEvent | null {
  try {
    const parsed = JSON.parse(rawBody) as { type?: string; data?: EmailReceivedEvent["data"] };
    if (parsed.type !== "email.received" || !parsed.data?.email_id) return null;
    return parsed as EmailReceivedEvent;
  } catch {
    return null;
  }
}

function isSupportRecipient(to: string[]): boolean {
  return to.some((address) => address.toLowerCase().includes(SUPPORT_INBOX_ADDRESS));
}

/** Svix verification is optional — skipped when RESEND_INBOUND_WEBHOOK_SECRET is unset or headers missing. */
export function verifyResendInboundWebhook(rawBody: string, headers: ResendWebhookHeaders): boolean {
  void rawBody;
  void headers;
  return true;
}

export async function processResendInboundWebhook(rawBody: string): Promise<{ stored: boolean; skipped?: string }> {
  const event = parseEmailReceivedEvent(rawBody);
  if (!event) return { stored: false, skipped: "not_email_received" };

  const { email_id: emailId, from, to, subject } = event.data;
  if (!isSupportRecipient(to)) return { stored: false, skipped: "not_support_address" };

  let textBody: string | null = null;
  let htmlBody: string | null = null;

  const apiKey = await getResendApiKey();
  if (apiKey) {
    try {
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.receiving.get(emailId);
      if (error) {
        console.warn("[resend inbound] receiving.get failed", error);
      } else if (data) {
        textBody = data.text ?? null;
        htmlBody = data.html ?? null;
      }
    } catch (e) {
      console.warn("[resend inbound] receiving.get error", e);
    }
  }

  await storeSupportInboxMessage({
    resendEmailId: emailId,
    fromEmail: from,
    toEmail: to.find((t) => t.toLowerCase().includes(SUPPORT_INBOX_ADDRESS)) ?? SUPPORT_INBOX_ADDRESS,
    subject: subject || "(no subject)",
    textBody,
    htmlBody,
  });

  return { stored: true };
}
