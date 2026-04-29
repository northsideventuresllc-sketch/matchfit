import { parseStoredHashtagsJson } from "@/lib/trainer-fithub-hashtags";
import { isTrainerPremiumStudioActive } from "@/lib/trainer-premium-studio";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!(await isTrainerPremiumStudioActive(trainerId))) {
      return NextResponse.json({ error: "Premium Page is required." }, { status: 403 });
    }

    const rows = await prisma.trainerFitHubPost.findMany({
      where: { trainerId },
      orderBy: { createdAt: "desc" },
      take: 120,
      select: {
        id: true,
        createdAt: true,
        postType: true,
        caption: true,
        bodyText: true,
        mediaUrl: true,
        mediaUrlsJson: true,
        hashtagsJson: true,
        shareCount: true,
        scheduledPublishAt: true,
        visibility: true,
        _count: {
          select: {
            likes: true,
            comments: true,
            reposts: true,
            clientShares: true,
          },
        },
      },
    });

    const now = Date.now();
    return NextResponse.json({
      posts: rows.map((p) => {
        const scheduled = p.scheduledPublishAt?.getTime();
        const isScheduled = scheduled != null && scheduled > now;
        const mediaUrls = (() => {
          try {
            const v = p.mediaUrlsJson ? (JSON.parse(p.mediaUrlsJson) as unknown) : null;
            return Array.isArray(v) ? v.filter((u): u is string => typeof u === "string") : [];
          } catch {
            return [];
          }
        })();
        return {
          id: p.id,
          createdAt: p.createdAt.toISOString(),
          postType: p.postType,
          caption: p.caption,
          bodyText: p.bodyText,
          mediaUrl: p.mediaUrl,
          mediaUrls,
          hashtags: parseStoredHashtagsJson(p.hashtagsJson),
          shareCount: p.shareCount,
          likeCount: p._count.likes,
          commentCount: p._count.comments,
          repostCount: p._count.reposts,
          recordedShareCount: p._count.clientShares,
          scheduledPublishAt: p.scheduledPublishAt?.toISOString() ?? null,
          visibility: p.visibility,
          isScheduled,
        };
      }),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load posts." }, { status: 500 });
  }
}
