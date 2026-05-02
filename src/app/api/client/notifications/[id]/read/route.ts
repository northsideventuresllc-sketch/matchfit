import { countClientUnreadInboxNotifications } from "@/lib/client-notification-retention";
import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { read?: boolean };

    const row = await prisma.clientNotification.findFirst({
      where: { id, clientId },
      select: { id: true, readAt: true },
    });
    if (!row) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const read = body.read !== false;
    await prisma.clientNotification.update({
      where: { id },
      data: { readAt: read ? new Date() : null },
    });

    const unreadCount = await countClientUnreadInboxNotifications(clientId);

    return NextResponse.json({ ok: true, unreadCount });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not update notification." }, { status: 500 });
  }
}
