import {
  queryClientNotificationsForApi,
  runClientNotificationLifecycle,
} from "@/lib/client-notification-retention";
import { ensureStarterClientNotifications } from "@/lib/client-notification-seed";
import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    await ensureStarterClientNotifications(clientId);
    await runClientNotificationLifecycle(clientId);

    const url = new URL(req.url);
    const box = url.searchParams.get("box") === "archive" ? "archive" : "inbox";

    const { items, unreadCount } = await queryClientNotificationsForApi(clientId, box);

    return NextResponse.json({
      box,
      unreadCount,
      notifications: items.map((n) => ({
        id: n.id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        linkHref: n.linkHref,
        read: n.readAt != null,
        createdAt: n.createdAt.toISOString(),
        archivedAt: n.archivedAt?.toISOString() ?? null,
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load notifications." }, { status: 500 });
  }
}
