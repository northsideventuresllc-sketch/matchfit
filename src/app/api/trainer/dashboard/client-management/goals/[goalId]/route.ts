import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  completed: z.boolean(),
});

type Ctx = { params: Promise<{ goalId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const { goalId } = await ctx.params;
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

    const row = await prisma.trainerClientGoal.findFirst({
      where: { id: goalId, trainerId },
    });
    if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });

    await prisma.trainerClientGoal.update({
      where: { id: goalId },
      data: { completedAt: parsed.data.completed ? new Date() : null },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not update goal." }, { status: 500 });
  }
}
