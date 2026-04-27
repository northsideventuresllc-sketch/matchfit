import { ensureStarterClientNotifications } from "@/lib/client-notification-seed";
import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
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

    const [items, unreadCount] = await Promise.all([
      prisma.clientNotification.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
        take: 80,
        select: {
          id: true,
          kind: true,
          title: true,
          body: true,
          linkHref: true,
          readAt: true,
          createdAt: true,
        },
      }),
      prisma.clientNotification.count({
        where: { clientId, readAt: null },
      }),
    ]);

    return NextResponse.json({
      unreadCount,
      notifications: items.map((n) => ({
        id: n.id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        linkHref: n.linkHref,
        read: n.readAt != null,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load notifications." }, { status: 500 });
  }
}
