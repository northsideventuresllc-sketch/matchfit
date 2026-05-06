import { createRescheduleProposal } from "@/lib/session-check-in-actions";
import { getSessionTrainerId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  note: z.string().trim().max(500).optional(),
});

type Ctx = { params: Promise<{ clientUsername: string; bookingId: string }> };

export async function POST(req: Request, ctx: Ctx) {
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
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    const res = await createRescheduleProposal({
      bookingId,
      actorIsTrainer: true,
      trainerId,
      clientId: client.id,
      proposedStartAt: new Date(parsed.data.startsAt),
      proposedEndAt: new Date(parsed.data.endsAt),
      note: parsed.data.note,
    });
    if ("error" in res) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, requestId: res.requestId });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not propose reschedule." }, { status: 500 });
  }
}
