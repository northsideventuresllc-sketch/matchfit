import { recordSessionTrainerPunchIn } from "@/lib/trainer-session-punch-in";
import { getSessionTrainerId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  accuracyMeters: z.number().finite().nullable().optional(),
});

type Ctx = { params: Promise<{ clientUsername: string; bookingId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "latitude and longitude are required." }, { status: 400 });
    }

    const { clientUsername, bookingId } = await ctx.params;
    const handle = decodeURIComponent(clientUsername).trim();
    const client = await prisma.client.findUnique({ where: { username: handle }, select: { id: true } });
    if (!client) return NextResponse.json({ error: "Client not found." }, { status: 404 });

    const booking = await prisma.bookedTrainingSession.findFirst({
      where: { id: bookingId, trainerId, clientId: client.id },
      select: { id: true },
    });
    if (!booking) return NextResponse.json({ error: "Session not found." }, { status: 404 });

    const res = await recordSessionTrainerPunchIn({
      bookingId,
      trainerId,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      accuracyMeters: parsed.data.accuracyMeters ?? null,
    });
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not record punch-in." }, { status: 500 });
  }
}
