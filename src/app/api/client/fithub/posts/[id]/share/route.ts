import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { id: postId } = await ctx.params;
    const post = await prisma.trainerFitHubPost.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const updated = await prisma.trainerFitHubPost.update({
      where: { id: postId },
      data: { shareCount: { increment: 1 } },
      select: { shareCount: true },
    });

    return NextResponse.json({ shareCount: updated.shareCount });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not record share." }, { status: 500 });
  }
}
