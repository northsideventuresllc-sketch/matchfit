import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ username: string }> };

/** Client acknowledges receipt — completes confirmation of receivables for DIY / cycle payouts. */
export async function POST(_req: Request, ctx: Ctx) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { username } = await ctx.params;
    const handle = decodeURIComponent(username).trim();
    const trainer = await prisma.trainer.findUnique({ where: { username: handle }, select: { id: true } });
    if (!trainer) return NextResponse.json({ error: "Coach not found." }, { status: 404 });

    const engagement = await prisma.diyPlanEngagement.findFirst({
      where: { trainerId: trainer.id, clientId },
      orderBy: { createdAt: "desc" },
    });
    if (!engagement) {
      return NextResponse.json({ error: "No DIY engagement on file." }, { status: 404 });
    }
    if (!engagement.trainerReceivableLoggedAt && !engagement.firstDeliveredAt) {
      return NextResponse.json({ error: "Your coach must log the first deliverable first." }, { status: 400 });
    }

    const now = new Date();
    await prisma.diyPlanEngagement.update({
      where: { id: engagement.id },
      data: {
        clientReceivableAcknowledgedAt: now,
        updatedAt: now,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not acknowledge." }, { status: 500 });
  }
}
