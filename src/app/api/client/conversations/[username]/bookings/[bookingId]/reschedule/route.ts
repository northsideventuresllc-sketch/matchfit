import { createRescheduleProposal } from "@/lib/session-check-in-actions";
import { getSessionClientId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  note: z.string().trim().max(500).optional(),
});

type Ctx = { params: Promise<{ username: string; bookingId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { username, bookingId } = await ctx.params;
    const handle = decodeURIComponent(username).trim();
    const trainer = await prisma.trainer.findUnique({ where: { username: handle }, select: { id: true } });
    if (!trainer) {
      return NextResponse.json({ error: "Coach not found." }, { status: 404 });
    }
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    const res = await createRescheduleProposal({
      bookingId,
      actorIsTrainer: false,
      trainerId: trainer.id,
      clientId,
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
