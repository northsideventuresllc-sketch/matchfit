import { withdrawRescheduleRequest } from "@/lib/session-check-in-actions";
import { getSessionClientId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ username: string; requestId: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { username, requestId } = await ctx.params;
    const handle = decodeURIComponent(username).trim();
    const trainer = await prisma.trainer.findUnique({ where: { username: handle }, select: { id: true } });
    if (!trainer) {
      return NextResponse.json({ error: "Coach not found." }, { status: 404 });
    }
    const res = await withdrawRescheduleRequest({
      requestId,
      actorIsTrainer: false,
      trainerId: trainer.id,
      clientId,
    });
    if ("error" in res) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not withdraw." }, { status: 500 });
  }
}
