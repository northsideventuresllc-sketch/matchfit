import { respondToRescheduleRequest } from "@/lib/session-check-in-actions";
import { getSessionClientId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  accept: z.boolean(),
});

type Ctx = { params: Promise<{ username: string; requestId: string }> };

export async function POST(req: Request, ctx: Ctx) {
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
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    const res = await respondToRescheduleRequest({
      requestId,
      actorIsTrainer: false,
      trainerId: trainer.id,
      clientId,
      accept: parsed.data.accept,
    });
    if ("error" in res) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not respond." }, { status: 500 });
  }
}
