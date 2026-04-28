import { isFitHubPostPubliclyInteractable } from "@/lib/fithub-public-feed";
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
    const post = await prisma.trainerFitHubPost.findUnique({
      where: { id: postId },
      select: { id: true, visibility: true, scheduledPublishAt: true },
    });
    if (!post || !isFitHubPostPubliclyInteractable(post)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const existing = await prisma.clientFitHubRepost.findUnique({
      where: { postId_clientId: { postId, clientId } },
    });
    if (existing) {
      await prisma.clientFitHubRepost.delete({ where: { id: existing.id } });
    } else {
      await prisma.clientFitHubRepost.create({ data: { postId, clientId } });
    }

    const reposts = await prisma.clientFitHubRepost.count({ where: { postId } });
    return NextResponse.json({ reposted: !existing, repostCount: reposts });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not update repost." }, { status: 500 });
  }
}
