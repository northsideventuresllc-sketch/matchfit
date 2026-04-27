import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, ctx: Ctx) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { id } = await ctx.params;

    const nudge = await prisma.trainerClientNudge.findFirst({
      where: { id, clientId },
    });
    if (!nudge) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    await prisma.trainerClientNudge.update({
      where: { id },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not update nudge." }, { status: 500 });
  }
}
