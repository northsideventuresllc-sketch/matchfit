import { getSessionTrainerId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  reason: z.string().trim().min(10).max(4000),
});

type Ctx = { params: Promise<{ clientUsername: string }> };

/** Full-package cancellation goes to Match Fit staff for payout review (per Terms). */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { clientUsername } = await ctx.params;
    const handle = decodeURIComponent(clientUsername).trim();
    const client = await prisma.client.findUnique({ where: { username: handle }, select: { id: true } });
    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }
    const conv = await prisma.trainerClientConversation.findUnique({
      where: { trainerId_clientId: { trainerId, clientId: client.id } },
      select: { id: true, officialChatStartedAt: true, archivedAt: true },
    });
    if (!conv?.officialChatStartedAt || conv.archivedAt) {
      return NextResponse.json({ error: "This chat is not open for requests." }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Please provide a clear reason (at least 10 characters)." }, { status: 400 });
    }
    const pending = await prisma.trainerPackageCancellationRequest.count({
      where: { conversationId: conv.id, status: "PENDING_REVIEW" },
    });
    if (pending > 0) {
      return NextResponse.json({ error: "You already have a package cancellation request in review." }, { status: 400 });
    }
    const row = await prisma.trainerPackageCancellationRequest.create({
      data: {
        conversationId: conv.id,
        trainerId,
        clientId: client.id,
        reason: parsed.data.reason,
        status: "PENDING_REVIEW",
      },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, requestId: row.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not submit request." }, { status: 500 });
  }
}
