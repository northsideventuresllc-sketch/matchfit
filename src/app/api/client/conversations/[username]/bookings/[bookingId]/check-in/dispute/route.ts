import { createSessionPayoutDispute } from "@/lib/session-check-in-actions";
import { getSessionClientId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  wasRescheduled: z.boolean(),
  wasCancelled: z.boolean(),
  reasonDetail: z.string().trim().min(1).max(8000),
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
    const booking = await prisma.bookedTrainingSession.findFirst({
      where: { id: bookingId, clientId, trainerId: trainer.id },
      select: { id: true },
    });
    if (!booking) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    const res = await createSessionPayoutDispute({
      bookingId,
      clientId,
      wasRescheduled: parsed.data.wasRescheduled,
      wasCancelled: parsed.data.wasCancelled,
      reasonDetail: parsed.data.reasonDetail,
    });
    if ("error" in res) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, disputeId: res.disputeId });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not open dispute." }, { status: 500 });
  }
}
