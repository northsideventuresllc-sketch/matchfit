import { fithubPublicFeedVisibilityWhere } from "@/lib/fithub-public-feed";
import { parseStoredHashtagsJson } from "@/lib/trainer-fithub-hashtags";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { getTrainerIdsMutedInTrainerFithub } from "@/lib/user-block-queries";
import { NextResponse } from "next/server";

function trainerDisplayName(trainer: {
  preferredName: string | null;
  firstName: string;
  lastName: string;
}): string {
  return (
    trainer.preferredName?.trim() ||
    [trainer.firstName, trainer.lastName].filter(Boolean).join(" ").trim() ||
    "Trainer"
  );
}

export async function GET() {
  try {
    const sessionTrainerId = await getSessionTrainerId();
    if (!sessionTrainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const muted = await getTrainerIdsMutedInTrainerFithub(sessionTrainerId);
    const mutedList = [...muted];
    const rows = await prisma.trainerFitHubPost.findMany({
      where: {
        AND: [fithubPublicFeedVisibilityWhere(), ...(mutedList.length ? [{ trainerId: { notIn: mutedList } }] : [])],
      },
      take: 80,
      include: {
        trainer: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            preferredName: true,
            profileImageUrl: true,
          },
        },
        _count: { select: { likes: true, comments: true, reposts: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      viewerTrainerId: sessionTrainerId,
      posts: rows.map((p) => ({
        id: p.id,
        createdAt: p.createdAt.toISOString(),
        postType: p.postType,
        caption: p.caption,
        bodyText: p.bodyText,
        mediaUrl: p.mediaUrl,
        mediaUrls: (() => {
          try {
            const v = p.mediaUrlsJson ? (JSON.parse(p.mediaUrlsJson) as unknown) : null;
            return Array.isArray(v) ? v.filter((u): u is string => typeof u === "string") : [];
          } catch {
            return [];
          }
        })(),
        hashtags: parseStoredHashtagsJson(p.hashtagsJson),
        shareCount: p.shareCount,
        counts: {
          likes: p._count.likes,
          comments: p._count.comments,
          reposts: p._count.reposts,
        },
        trainer: {
          id: p.trainer.id,
          username: p.trainer.username,
          displayName: trainerDisplayName(p.trainer),
          profileImageUrl: p.trainer.profileImageUrl,
        },
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load FitHub." }, { status: 500 });
  }
}
