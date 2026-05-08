import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientUsername: string }> };

/** Logs first DIY deliverable & receivable handshake start (confirmation of receivables). Sets 14-day release floor when absent. */
export async function POST(_req: Request, ctx: Ctx) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { clientUsername } = await ctx.params;
    const handle = decodeURIComponent(clientUsername).trim();
    const client = await prisma.client.findUnique({ where: { username: handle }, select: { id: true } });
    if (!client) return NextResponse.json({ error: "Client not found." }, { status: 404 });

    const engagement = await prisma.diyPlanEngagement.findFirst({
      where: { trainerId, clientId: client.id },
      orderBy: { createdAt: "desc" },
    });
    if (!engagement) {
      return NextResponse.json({ error: "No DIY engagement on file." }, { status: 404 });
    }

    const now = new Date();
    const release = new Date(now);
    release.setDate(release.getDate() + 14);

    await prisma.diyPlanEngagement.update({
      where: { id: engagement.id },
      data: {
        trainerReceivableLoggedAt: engagement.trainerReceivableLoggedAt ?? now,
        firstDeliveredAt: engagement.firstDeliveredAt ?? now,
        status: engagement.firstDeliveredAt ? engagement.status : "DELIVERED",
        cycleFundsReleaseNotBeforeAt: engagement.cycleFundsReleaseNotBeforeAt ?? release,
        updatedAt: now,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not log deliverable." }, { status: 500 });
  }
}
