import { parseFitHubContentReportCategory } from "@/lib/fithub-content-report-categories";
import { isFitHubPostPubliclyInteractable } from "@/lib/fithub-public-feed";
import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

const MAX_DETAILS = 4000;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { id: rawId } = await ctx.params;
    const postId = rawId?.trim();
    if (!postId) {
      return NextResponse.json({ error: "Invalid post." }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      category?: string;
      details?: string;
    };
    const category = parseFitHubContentReportCategory(body.category);
    const details =
      typeof body.details === "string" ? body.details.trim().slice(0, MAX_DETAILS) : "";
    if (category === "other" && !details) {
      return NextResponse.json(
        { error: "Please add a short description when you choose Something else." },
        { status: 400 },
      );
    }

    const post = await prisma.trainerFitHubPost.findUnique({
      where: { id: postId },
      select: { id: true, visibility: true, scheduledPublishAt: true },
    });
    if (!post || !isFitHubPostPubliclyInteractable(post)) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    const existing = await prisma.trainerFitHubPostReport.findUnique({
      where: { postId_clientId: { postId, clientId } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({
        ok: true,
        alreadyReported: true,
        message: "You have already reported this post. Our team will review it.",
      });
    }

    await prisma.trainerFitHubPostReport.create({
      data: {
        postId,
        clientId,
        category,
        details: details || null,
      },
    });

    return NextResponse.json({
      ok: true,
      alreadyReported: false,
      message:
        "Thank you for helping keep Match Fit safe. Your report was submitted for review. We may take action if the content violates our guidelines.",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not submit report." }, { status: 500 });
  }
}
