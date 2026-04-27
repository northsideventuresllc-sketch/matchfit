import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

const TYPES = new Set(["TEXT", "IMAGE", "VIDEO"]);

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const json = (await req.json().catch(() => ({}))) as {
      postType?: string;
      caption?: string;
      bodyText?: string;
      mediaUrl?: string;
    };
    const postType = json.postType?.trim().toUpperCase() ?? "";
    if (!TYPES.has(postType)) {
      return NextResponse.json({ error: "postType must be TEXT, IMAGE, or VIDEO." }, { status: 400 });
    }

    const caption = json.caption?.trim() || null;
    const bodyText = json.bodyText?.trim() || null;
    const mediaUrl = json.mediaUrl?.trim() || null;

    if (postType === "TEXT" && !bodyText && !caption) {
      return NextResponse.json({ error: "Text posts need a caption or body." }, { status: 400 });
    }
    if ((postType === "IMAGE" || postType === "VIDEO") && !mediaUrl && !bodyText && !caption) {
      return NextResponse.json({ error: "Media posts need a media URL, caption, or body." }, { status: 400 });
    }

    const post = await prisma.trainerFitHubPost.create({
      data: {
        trainerId,
        postType,
        caption,
        bodyText,
        mediaUrl,
      },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json({ id: post.id, createdAt: post.createdAt.toISOString() });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not create post." }, { status: 500 });
  }
}
