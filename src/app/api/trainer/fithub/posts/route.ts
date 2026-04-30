import {
  extractHashtagsFromCaption,
  mergeHashtagLists,
  normalizeHashtagToken,
  parseHashtagListFromInput,
} from "@/lib/trainer-fithub-hashtags";
import { isTrainerPremiumStudioActive } from "@/lib/trainer-premium-studio";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

const TYPES = new Set(["TEXT", "IMAGE", "VIDEO", "CAROUSEL"]);
const VIS = new Set(["PUBLIC", "PRIVATE"]);

const MS_DAY = 24 * 60 * 60 * 1000;

function parseScheduledPublishAt(raw: string | null | undefined): Date | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const now = Date.now();
  if (d.getTime() <= now + 60_000) return null;
  if (d.getTime() > now + 365 * MS_DAY) {
    throw new Error("Schedule cannot be more than 365 days in advance.");
  }
  return d;
}

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!(await isTrainerPremiumStudioActive(trainerId))) {
      return NextResponse.json({ error: "Premium Page is required to publish to FitHub." }, { status: 403 });
    }

    const json = (await req.json().catch(() => ({}))) as {
      postType?: string;
      caption?: string;
      bodyText?: string;
      mediaUrl?: string;
      mediaUrls?: string[];
      hashtags?: string[];
      hashtagInput?: string;
      scheduledPublishAt?: string | null;
      visibility?: string;
    };

    const postType = json.postType?.trim().toUpperCase() ?? "";
    if (!TYPES.has(postType)) {
      return NextResponse.json({ error: "postType must be TEXT, IMAGE, VIDEO, or CAROUSEL." }, { status: 400 });
    }

    const caption = json.caption?.trim() || null;
    const bodyText = json.bodyText?.trim() || null;
    const mediaUrl = json.mediaUrl?.trim() || null;
    const mediaUrls = Array.isArray(json.mediaUrls)
      ? json.mediaUrls.map((u) => (typeof u === "string" ? u.trim() : "")).filter(Boolean).slice(0, 12)
      : [];

    const visibilityRaw = json.visibility?.trim().toUpperCase() ?? "PUBLIC";
    const visibility = VIS.has(visibilityRaw) ? visibilityRaw : "PUBLIC";

    let scheduledPublishAt: Date | null = null;
    try {
      scheduledPublishAt = parseScheduledPublishAt(json.scheduledPublishAt ?? undefined);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid schedule.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const fromExplicit = Array.isArray(json.hashtags)
      ? ([...new Set(json.hashtags.map((t) => normalizeHashtagToken(String(t))).filter(Boolean))] as string[])
      : [];
    const tagList = mergeHashtagLists(
      fromExplicit,
      mergeHashtagLists(parseHashtagListFromInput(json.hashtagInput), extractHashtagsFromCaption(caption)),
    );
    const hashtagsJson = tagList.length ? JSON.stringify(tagList) : null;

    if (postType === "TEXT") {
      if (!bodyText && !caption) {
        return NextResponse.json({ error: "Check-in posts need a caption or body." }, { status: 400 });
      }
    }

    if (postType === "IMAGE" || postType === "VIDEO") {
      if (!mediaUrl && !bodyText && !caption) {
        return NextResponse.json({ error: "Media posts need a file, caption, or body." }, { status: 400 });
      }
    }

    if (postType === "CAROUSEL") {
      if (mediaUrls.length < 2) {
        return NextResponse.json({ error: "Carousel posts need at least two images or videos." }, { status: 400 });
      }
    }

    const mediaUrlsJson = postType === "CAROUSEL" ? JSON.stringify(mediaUrls) : null;
    const primaryMediaUrl = postType === "CAROUSEL" ? mediaUrls[0] ?? null : mediaUrl;

    const post = await prisma.trainerFitHubPost.create({
      data: {
        trainerId,
        postType,
        caption,
        bodyText,
        mediaUrl: primaryMediaUrl,
        mediaUrlsJson,
        hashtagsJson,
        scheduledPublishAt,
        visibility,
      },
      select: { id: true, createdAt: true, scheduledPublishAt: true },
    });

    return NextResponse.json({
      id: post.id,
      createdAt: post.createdAt.toISOString(),
      scheduledPublishAt: post.scheduledPublishAt?.toISOString() ?? null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not create post." }, { status: 500 });
  }
}
