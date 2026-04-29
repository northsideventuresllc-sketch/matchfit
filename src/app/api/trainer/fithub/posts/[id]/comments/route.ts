import { NextResponse } from "next/server";
import { isTrainerPremiumStudioActive } from "@/lib/trainer-premium-studio";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!(await isTrainerPremiumStudioActive(trainerId))) {
      return NextResponse.json({ error: "Premium Page is required." }, { status: 403 });
    }

    const { id: postId } = await ctx.params;
    const post = await prisma.trainerFitHubPost.findFirst({
      where: { id: postId, trainerId },
      select: { id: true },
    });
    if (!post) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const rows = await prisma.trainerFitHubComment.findMany({
      where: { postId },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: {
        id: true,
        createdAt: true,
        body: true,
        client: { select: { firstName: true, preferredName: true } },
      },
    });

    const comments = rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      body: r.body,
      authorLabel: (() => {
        const p = r.client.preferredName?.trim();
        if (p) return p;
        const f = r.client.firstName?.trim();
        if (f) return f;
        return "Member";
      })(),
    }));

    return NextResponse.json({ comments });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load comments." }, { status: 500 });
  }
}
