import { isFitHubPostPubliclyInteractable } from "@/lib/fithub-public-feed";
import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

function isUniqueConstraint(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

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

    try {
      await prisma.clientFitHubPostShare.create({
        data: { postId, clientId },
      });
    } catch (e) {
      if (!isUniqueConstraint(e)) throw e;
      const current = await prisma.trainerFitHubPost.findUnique({
        where: { id: postId },
        select: { shareCount: true },
      });
      return NextResponse.json({ shareCount: current?.shareCount ?? 0, alreadyShared: true });
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
