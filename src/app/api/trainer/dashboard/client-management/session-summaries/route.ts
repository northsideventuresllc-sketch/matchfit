import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  clientId: z.string().min(1),
  occurredAt: z.string().datetime(),
  body: z.string().min(1).max(20_000),
});

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const parsed = postSchema.safeParse(await req.json().catch(() => null));
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

    const occurredAt = new Date(parsed.data.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) return NextResponse.json({ error: "Bad date." }, { status: 400 });

    const s = await prisma.trainerClientSessionSummary.create({
      data: {
        trainerId,
        clientId: parsed.data.clientId,
        occurredAt,
        body: parsed.data.body,
      },
    });
    return NextResponse.json({
      summary: {
        id: s.id,
        occurredAt: s.occurredAt.toISOString(),
        body: s.body,
        emailedAt: null,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not save summary." }, { status: 500 });
  }
}
