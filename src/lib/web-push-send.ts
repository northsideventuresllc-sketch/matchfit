import webpush from "web-push";
import { prisma } from "@/lib/prisma";

export type WebPushPayload = {
  title: string;
  body: string;
  /** Relative in-app path (e.g. `/client/dashboard/notifications`) */
  url?: string;
};

let vapidConfigured = false;

export function isWebPushConfigured(): boolean {
  const pub = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  const contact = process.env.WEB_PUSH_CONTACT_EMAIL?.trim();
  return Boolean(pub && priv && contact);
}

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;
  const pub = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  const contact = process.env.WEB_PUSH_CONTACT_EMAIL?.trim();
  if (!pub || !priv || !contact) return false;
  webpush.setVapidDetails(`mailto:${contact}`, pub, priv);
  vapidConfigured = true;
  return true;
}

async function removeDeadSubscription(id: string): Promise<void> {
  try {
    await prisma.webPushSubscription.delete({ where: { id } });
  } catch {
    /* ignore */
  }
}

/**
 * Sends a Web Push to every stored subscription for the user. Invalid endpoints (410) are removed.
 * No-ops when VAPID keys are not configured or the user has no subscriptions.
 */
export async function sendWebPushToClient(clientId: string, payload: WebPushPayload): Promise<{ sent: number }> {
  if (!ensureVapidConfigured()) return { sent: 0 };
  const rows = await prisma.webPushSubscription.findMany({ where: { clientId } });
  let sent = 0;
  const json = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? null,
  });
  for (const row of rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        json,
        { TTL: 86_400 },
      );
      sent += 1;
    } catch (e: unknown) {
      const status = typeof e === "object" && e && "statusCode" in e ? (e as { statusCode?: number }).statusCode : undefined;
      if (status === 404 || status === 410) {
        await removeDeadSubscription(row.id);
      } else {
        console.error("[web-push] send failed", { clientId, subscriptionId: row.id, status, e });
      }
    }
  }
  return { sent };
}

export async function sendWebPushToTrainer(trainerId: string, payload: WebPushPayload): Promise<{ sent: number }> {
  if (!ensureVapidConfigured()) return { sent: 0 };
  const rows = await prisma.webPushSubscription.findMany({ where: { trainerId } });
  let sent = 0;
  const json = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? null,
  });
  for (const row of rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        json,
        { TTL: 86_400 },
      );
      sent += 1;
    } catch (e: unknown) {
      const status = typeof e === "object" && e && "statusCode" in e ? (e as { statusCode?: number }).statusCode : undefined;
      if (status === 404 || status === 410) {
        await removeDeadSubscription(row.id);
      } else {
        console.error("[web-push] send failed", { trainerId, subscriptionId: row.id, status, e });
      }
    }
  }
  return { sent };
}
