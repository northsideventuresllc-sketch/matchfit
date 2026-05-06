import { trainerCompletesGateB } from "@/lib/session-check-in-actions";
import { getSessionTrainerId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientUsername: string; bookingId: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { clientUsername, bookingId } = await ctx.params;
    const handle = decodeURIComponent(clientUsername).trim();
    const client = await prisma.client.findUnique({ where: { username: handle }, select: { id: true } });
    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }
    const booking = await prisma.bookedTrainingSession.findFirst({
      where: { id: bookingId, trainerId, clientId: client.id },
      select: { id: true },
    });
    if (!booking) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }
    const res = await trainerCompletesGateB({ bookingId, trainerId });
    if ("error" in res) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not complete Gate B." }, { status: 500 });
  }
}
