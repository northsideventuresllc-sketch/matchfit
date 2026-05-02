import {
  countClientUnreadInboxNotifications,
  isClientNotificationArchivedAtSchemaError,
} from "@/lib/client-notification-retention";
import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { id } = await ctx.params;

    let row: { id: string } | null;
    try {
      row = await prisma.clientNotification.findFirst({
        where: { id, clientId, archivedAt: null },
        select: { id: true },
      });
    } catch (e) {
      if (!isClientNotificationArchivedAtSchemaError(e)) throw e;
      row = await prisma.clientNotification.findFirst({
        where: { id, clientId },
        select: { id: true },
      });
    }
    if (!row) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    try {
      await prisma.clientNotification.update({
        where: { id },
        data: { archivedAt: new Date() },
      });
    } catch (e) {
      if (isClientNotificationArchivedAtSchemaError(e)) {
        return NextResponse.json(
          {
            error:
              "Notification archive requires an updated database. From the repo root run: npx prisma migrate deploy",
          },
          { status: 503 },
        );
      }
      throw e;
    }

    const unreadCount = await countClientUnreadInboxNotifications(clientId);

    return NextResponse.json({ ok: true, unreadCount });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not archive notification." }, { status: 500 });
  }
}
