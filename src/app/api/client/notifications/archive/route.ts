import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function DELETE() {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    await prisma.clientNotification.deleteMany({
      where: { clientId, archivedAt: { not: null } },
    });

    const unreadCount = await prisma.clientNotification.count({
      where: { clientId, readAt: null, archivedAt: null },
    });

    return NextResponse.json({ ok: true, unreadCount });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not clear archive." }, { status: 500 });
  }
}
