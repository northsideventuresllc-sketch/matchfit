import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

/** Permanently delete selected archived notifications (ids must belong to the client and be archived). */
export async function POST(req: Request) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
    const raw = body.ids;
    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json({ error: "ids must be a non-empty array." }, { status: 400 });
    }
    const ids = raw.map((x) => String(x).trim()).filter(Boolean);
    if (!ids.length) {
      return NextResponse.json({ error: "No valid ids." }, { status: 400 });
    }

    const deleted = await prisma.clientNotification.deleteMany({
      where: {
        clientId,
        archivedAt: { not: null },
        id: { in: ids },
      },
    });

    const unreadCount = await prisma.clientNotification.count({
      where: { clientId, readAt: null, archivedAt: null },
    });

    return NextResponse.json({ ok: true, deletedCount: deleted.count, unreadCount });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not delete notifications." }, { status: 500 });
  }
}
