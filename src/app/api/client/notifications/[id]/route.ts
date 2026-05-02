import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

/** Permanently remove one archived notification for the signed-in client. */
export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { id } = await ctx.params;

    const deleted = await prisma.clientNotification.deleteMany({
      where: { id, clientId, archivedAt: { not: null } },
    });
    if (deleted.count === 0) {
      return NextResponse.json({ error: "Not found or not archived." }, { status: 404 });
    }

    const unreadCount = await prisma.clientNotification.count({
      where: { clientId, readAt: null, archivedAt: null },
    });

    return NextResponse.json({ ok: true, unreadCount });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not delete notification." }, { status: 500 });
  }
}
