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

    const existing = await prisma.trainerFitHubPostLike.findUnique({
      where: { postId_clientId: { postId, clientId } },
    });
    if (existing) {
      await prisma.trainerFitHubPostLike.delete({ where: { id: existing.id } });
    } else {
      await prisma.trainerFitHubPostLike.create({ data: { postId, clientId } });
    }

    const likes = await prisma.trainerFitHubPostLike.count({ where: { postId } });
    return NextResponse.json({ liked: !existing, likeCount: likes });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not update like." }, { status: 500 });
  }
}
