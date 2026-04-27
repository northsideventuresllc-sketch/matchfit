import type { Prisma } from "@prisma/client";
import { ensureClientFitHubSamplePosts } from "@/lib/client-fithub-sample-posts";
import { parseClientFithubPrefsJson } from "@/lib/client-fithub-prefs";
import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

function coachDisplayName(trainer: {
  preferredName: string | null;
  firstName: string;
  lastName: string;
}): string {
  return (
    trainer.preferredName?.trim() ||
    [trainer.firstName, trainer.lastName].filter(Boolean).join(" ").trim() ||
    "Coach"
  );
}

function scorePost(
  p: {
    createdAt: Date;
    trainerId: string;
    shareCount: number;
    _count: { likes: number; comments: number; reposts: number };
  },
  prefs: ReturnType<typeof parseClientFithubPrefsJson>,
  savedIds: Set<string>,
): number {
  let s = p._count.likes * 2 + p._count.comments * 3 + p._count.reposts * 4 + p.shareCount;
  if (prefs.prioritizeSavedCoaches && savedIds.has(p.trainerId)) s += 40;
  if (prefs.onlyTrainersInYourArea && savedIds.has(p.trainerId)) s += 25;
  const ageH = (Date.now() - p.createdAt.getTime()) / 3600000;
  s += Math.max(0, 48 - ageH);
  return s;
}

function dedupeByTrainer<T extends { trainerId: string }>(posts: T[], enabled: boolean): T[] {
  if (!enabled) return posts;
  const seen = new Set<string>();
  const out: T[] = [];
  for (const p of posts) {
    if (seen.has(p.trainerId)) continue;
    seen.add(p.trainerId);
    out.push(p);
  }
  return out;
}

export async function GET() {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, fitHubPrefsJson: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    await ensureClientFitHubSamplePosts();
    const prefs = parseClientFithubPrefsJson(client.fitHubPrefsJson);

    const types: string[] = [];
    if (prefs.showTextPosts) types.push("TEXT");
    if (prefs.showImagePosts) types.push("IMAGE");
    if (prefs.showVideoPosts) types.push("VIDEO");
    if (!types.length) types.push("TEXT");

    const savedRows = await prisma.clientSavedTrainer.findMany({
      where: { clientId },
      select: { trainerId: true },
    });
    const savedIds = new Set(savedRows.map((r) => r.trainerId));

    const where: Prisma.TrainerFitHubPostWhereInput = {
      postType: { in: types },
    };
    if (prefs.feedStyle === "SAVED_COACHES_ONLY") {
      if (!savedIds.size) {
        return NextResponse.json({
          posts: [],
          feedEmptyReason: "SAVED_COACHES_ONLY",
          preferences: prefs,
        });
      }
      where.trainerId = { in: [...savedIds] };
    }

    const takeRaw = prefs.feedStyle === "ALGORITHMIC" ? 180 : 60;
    const rows = await prisma.trainerFitHubPost.findMany({
      where,
      take: takeRaw,
      orderBy: { createdAt: "desc" },
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
        likes: { where: { clientId }, select: { id: true } },
        reposts: { where: { clientId }, select: { id: true } },
        _count: { select: { likes: true, comments: true, reposts: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          take: 20,
          include: {
            client: { select: { id: true, preferredName: true, username: true } },
          },
        },
      },
    });

    let sorted = [...rows];
    if (prefs.feedStyle === "ALGORITHMIC") {
      sorted.sort((a, b) => scorePost(b, prefs, savedIds) - scorePost(a, prefs, savedIds));
      sorted = sorted.slice(0, 60);
    } else {
      sorted = sorted.slice(0, 60);
    }

    sorted = dedupeByTrainer(sorted, prefs.hideRepeatedTrainers);

    const postIds = sorted.map((p) => p.id);
    const reportedRows =
      postIds.length > 0
        ? await prisma.trainerFitHubPostReport.findMany({
            where: { clientId, postId: { in: postIds } },
            select: { postId: true },
          })
        : [];
    const reportedPostIds = new Set(reportedRows.map((r) => r.postId));

    return NextResponse.json({
      feedEmptyReason: null as string | null,
      preferences: prefs,
      posts: sorted.map((p) => ({
        id: p.id,
        createdAt: p.createdAt.toISOString(),
        postType: p.postType,
        caption: p.caption,
        bodyText: p.bodyText,
        mediaUrl: p.mediaUrl,
        shareCount: p.shareCount,
        likedByMe: p.likes.length > 0,
        repostedByMe: p.reposts.length > 0,
        counts: {
          likes: p._count.likes,
          comments: p._count.comments,
          reposts: p._count.reposts,
        },
        reportedByMe: reportedPostIds.has(p.id),
        trainer: {
          username: p.trainer.username,
          displayName: coachDisplayName(p.trainer),
          profileImageUrl: p.trainer.profileImageUrl,
        },
        comments: p.comments.map((c) => ({
          id: c.id,
          createdAt: c.createdAt.toISOString(),
          body: c.body,
          isMine: c.clientId === clientId,
          authorLabel:
            c.clientId === clientId
              ? "You"
              : c.client.preferredName?.trim() || `@${c.client.username}`,
        })),
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load feed." }, { status: 500 });
  }
}
