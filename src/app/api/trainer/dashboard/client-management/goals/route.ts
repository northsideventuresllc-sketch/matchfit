import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  clientId: z.string().min(1),
  horizon: z.enum(["SHORT", "LONG", "GENERAL"]),
  goalText: z.string().min(1).max(4000),
  completionCriteria: z.string().min(1).max(8000),
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

    const g = await prisma.trainerClientGoal.create({
      data: {
        trainerId,
        clientId: parsed.data.clientId,
        horizon: parsed.data.horizon,
        goalText: parsed.data.goalText,
        completionCriteria: parsed.data.completionCriteria,
      },
    });
    return NextResponse.json({
      goal: {
        id: g.id,
        horizon: g.horizon,
        goalText: g.goalText,
        completionCriteria: g.completionCriteria,
        completedAt: g.completedAt?.toISOString() ?? null,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not create goal." }, { status: 500 });
  }
}
