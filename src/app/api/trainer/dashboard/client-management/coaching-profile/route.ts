import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const putSchema = z.object({
  clientId: z.string().min(1),
  generalNotes: z.string().max(20_000).optional(),
  medicalInjuryNotes: z.string().max(20_000).optional(),
});

export async function PUT(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const parsed = putSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

    const conv = await prisma.trainerClientConversation.findFirst({
      where: { trainerId, clientId: parsed.data.clientId },
      select: { id: true },
    });
    const booking = await prisma.bookedTrainingSession.findFirst({
      where: { trainerId, clientId: parsed.data.clientId },
      select: { id: true },
    });
    if (!conv && !booking) return NextResponse.json({ error: "Pair not found." }, { status: 404 });

    await prisma.trainerClientCoachingProfile.upsert({
      where: { trainerId_clientId: { trainerId, clientId: parsed.data.clientId } },
      create: {
        trainerId,
        clientId: parsed.data.clientId,
        generalNotes: parsed.data.generalNotes ?? null,
        medicalInjuryNotes: parsed.data.medicalInjuryNotes ?? null,
      },
      update: {
        generalNotes: parsed.data.generalNotes ?? null,
        medicalInjuryNotes: parsed.data.medicalInjuryNotes ?? null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not save profile." }, { status: 500 });
  }
}
