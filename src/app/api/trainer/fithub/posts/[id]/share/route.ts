import { isTrainerPremiumStudioActive } from "@/lib/trainer-premium-studio";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!(await isTrainerPremiumStudioActive(trainerId))) {
      return NextResponse.json({ error: "Premium Page is required." }, { status: 403 });
    }

    const { id: postId } = await ctx.params;
    const post = await prisma.trainerFitHubPost.findUnique({
      where: { id: postId },
      select: { id: true, trainerId: true },
    });
    if (!post || post.trainerId !== trainerId) {
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
