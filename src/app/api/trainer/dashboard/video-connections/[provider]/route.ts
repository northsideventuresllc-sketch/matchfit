import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["GOOGLE", "ZOOM", "MICROSOFT"]);

type Ctx = { params: Promise<{ provider: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { provider } = await ctx.params;
    const p = decodeURIComponent(provider).trim().toUpperCase();
    if (!ALLOWED.has(p)) {
      return NextResponse.json({ error: "Unknown provider." }, { status: 400 });
    }
    await prisma.trainerVideoConferenceConnection.updateMany({
      where: { trainerId, provider: p, revokedAt: null },
      data: { revokedAt: new Date(), updatedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not disconnect." }, { status: 500 });
  }
}
