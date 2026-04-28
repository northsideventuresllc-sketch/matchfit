import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { read?: boolean };

    const row = await prisma.trainerNotification.findFirst({
      where: { id, trainerId },
    });
    if (!row) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const read = body.read !== false;
    await prisma.trainerNotification.update({
      where: { id },
      data: { readAt: read ? new Date() : null },
    });

    const unreadCount = await prisma.trainerNotification.count({
      where: { trainerId, readAt: null },
    });

    return NextResponse.json({ ok: true, unreadCount });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not update notification." }, { status: 500 });
  }
}
