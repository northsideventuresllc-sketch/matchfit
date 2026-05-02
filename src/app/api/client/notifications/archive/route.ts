import {
  countClientUnreadInboxNotifications,
  isClientNotificationArchivedAtSchemaError,
} from "@/lib/client-notification-retention";
import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function DELETE() {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    try {
      await prisma.clientNotification.deleteMany({
        where: { clientId, archivedAt: { not: null } },
      });
    } catch (e) {
      if (!isClientNotificationArchivedAtSchemaError(e)) throw e;
    }

    const unreadCount = await countClientUnreadInboxNotifications(clientId);

    return NextResponse.json({ ok: true, unreadCount });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not clear archive." }, { status: 500 });
  }
}
