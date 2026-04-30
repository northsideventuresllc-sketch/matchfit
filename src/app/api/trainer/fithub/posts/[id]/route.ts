import { isTrainerPremiumStudioActive } from "@/lib/trainer-premium-studio";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
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

    const json = (await req.json().catch(() => ({}))) as { visibility?: string };
    const vis = json.visibility?.trim().toUpperCase();
    if (vis !== "PUBLIC" && vis !== "PRIVATE") {
      return NextResponse.json({ error: "visibility must be PUBLIC or PRIVATE." }, { status: 400 });
    }

    await prisma.trainerFitHubPost.update({
      where: { id: postId },
      data: { visibility: vis },
    });

    return NextResponse.json({ ok: true, visibility: vis });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not update post." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
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
      select: { id: true, trainerId: true, demoSeedKey: true },
    });
    if (!post || post.trainerId !== trainerId) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (post.demoSeedKey) {
      return NextResponse.json({ error: "Demo seed posts cannot be deleted." }, { status: 400 });
    }

    await prisma.trainerFitHubPost.delete({ where: { id: postId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not delete post." }, { status: 500 });
  }
}
