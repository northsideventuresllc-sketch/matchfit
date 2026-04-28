import { isFitHubPostPubliclyInteractable } from "@/lib/fithub-public-feed";
import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
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

    const body = (await req.json().catch(() => ({}))) as { body?: string };
    const text = body.body?.trim() ?? "";
    if (text.length < 1 || text.length > 2000) {
      return NextResponse.json({ error: "Comment must be 1–2000 characters." }, { status: 400 });
    }

    const row = await prisma.trainerFitHubComment.create({
      data: { postId, clientId, body: text },
      include: {
        client: { select: { id: true, preferredName: true, username: true } },
      },
    });

    const commentCount = await prisma.trainerFitHubComment.count({ where: { postId } });

    return NextResponse.json({
      commentCount,
      comment: {
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        body: row.body,
        isMine: true,
        authorLabel: "You",
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not post comment." }, { status: 500 });
  }
}
