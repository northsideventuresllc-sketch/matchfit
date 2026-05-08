import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  miles: z.number().finite().positive().max(5000),
  occurredAt: z.string().datetime(),
  note: z.string().max(2000).optional(),
  bookedTrainingSessionId: z.string().min(1).optional(),
  source: z.enum(["MANUAL", "THIRD_PARTY_LINK"]).optional(),
});

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

    const occurredAt = new Date(parsed.data.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      return NextResponse.json({ error: "Invalid occurredAt." }, { status: 400 });
    }

    let bookingOk: string | null = null;
    if (parsed.data.bookedTrainingSessionId) {
      const b = await prisma.bookedTrainingSession.findFirst({
        where: { id: parsed.data.bookedTrainingSessionId, trainerId },
        select: { id: true },
      });
      if (!b) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
      bookingOk = b.id;
    }

    await prisma.trainerBusinessMileageEntry.create({
      data: {
        trainerId,
        miles: parsed.data.miles,
        occurredAt,
        note: parsed.data.note ?? null,
        bookedTrainingSessionId: bookingOk,
        source: parsed.data.source ?? "MANUAL",
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not save mileage." }, { status: 500 });
  }
}
