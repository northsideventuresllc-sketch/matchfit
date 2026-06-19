import { fithubPostPublicInteractSelect, isFitHubPostPubliclyInteractable } from "@/lib/fithub-public-feed";
import {
  clientHasFullPlanAccess,
  freemiumGateError,
  loadClientPlanGate,
} from "@/lib/client-plan-access";
import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

async function blockFreemiumFitHubInteract(clientId: string) {
  const plan = await loadClientPlanGate(clientId);
  if (plan && !clientHasFullPlanAccess(plan)) {
    return NextResponse.json(freemiumGateError("FREEMIUM_NO_FITHUB_INTERACT"), { status: 403 });
  }
  return null;
}

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const blocked = await blockFreemiumFitHubInteract(clientId);
    if (blocked) return blocked;
    const { id: postId } = await ctx.params;
    const post = await prisma.trainerFitHubPost.findUnique({
      where: { id: postId },
      select: fithubPostPublicInteractSelect,
    });
    if (!post || !isFitHubPostPubliclyInteractable(post)) {
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
