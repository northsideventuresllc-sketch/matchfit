import type { Prisma } from "@prisma/client";
import { ensureClientFitHubSamplePosts } from "@/lib/client-fithub-sample-posts";
import { parseClientFithubPrefsJson } from "@/lib/client-fithub-prefs";
import { clientPreferenceSearchTokens, parseClientMatchPreferencesJson } from "@/lib/client-match-preferences";
import { clientZipToPrefix } from "@/lib/featured-region";
import { fithubPublicFeedVisibilityWhere } from "@/lib/fithub-public-feed";
import { parseStoredHashtagsJson } from "@/lib/trainer-fithub-hashtags";
import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { getTrainerIdsHiddenFromClientFithub } from "@/lib/user-block-queries";
import { loadActivePromotionsForPosts, promotionRegionalFeedBoost } from "@/lib/trainer-promo-tokens";
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

function hashtagInterestBoost(postTags: string[], clientHaystackTokens: Set<string>): number {
  if (!postTags.length || !clientHaystackTokens.size) return 0;
  let bonus = 0;
  for (const tag of postTags) {
    if (clientHaystackTokens.has(tag)) bonus += 14;
    for (const tok of clientHaystackTokens) {
      if (tok.length > 2 && (tok.includes(tag) || tag.includes(tok))) bonus += 5;
    }
  }
  return Math.min(bonus, 36);
}

function scorePost(
  p: {
    id: string;
    createdAt: Date;
    trainerId: string;
    shareCount: number;
    hashtagsJson: string | null;
    _count: { likes: number; comments: number; reposts: number };
  },
  prefs: ReturnType<typeof parseClientFithubPrefsJson>,
  savedIds: Set<string>,
  clientMatchTokens: Set<string>,
  promotionBoost: number,
): number {
  let s = p._count.likes * 2 + p._count.comments * 3 + p._count.reposts * 4 + p.shareCount;
  if (prefs.prioritizeSavedCoaches && savedIds.has(p.trainerId)) s += 40;
  if (prefs.onlyTrainersInYourArea && savedIds.has(p.trainerId)) s += 25;
  s += hashtagInterestBoost(parseStoredHashtagsJson(p.hashtagsJson), clientMatchTokens);
  const ageH = (Date.now() - p.createdAt.getTime()) / 3600000;
  s += Math.max(0, 48 - ageH);
  s += promotionBoost;
  return s;
}

/** Keep sort order; at most one post per trainer; stop at `limit` posts (used when hideRepeatedTrainers is on). */
function takeUniqueTrainersInOrder<T extends { trainerId: string }>(posts: T[], limit: number): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const p of posts) {
    if (seen.has(p.trainerId)) continue;
    seen.add(p.trainerId);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

function applyFeedLengthCap<T extends { trainerId: string }>(
  posts: T[],
  hideRepeatedTrainers: boolean,
  limit: number,
): T[] {
  if (hideRepeatedTrainers) return takeUniqueTrainersInOrder(posts, limit);
  return posts.slice(0, limit);
}

export async function GET() {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, fitHubPrefsJson: true, matchPreferencesJson: true, zipCode: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    await ensureClientFitHubSamplePosts();
    const prefs = parseClientFithubPrefsJson(client.fitHubPrefsJson);
    const matchPrefs = parseClientMatchPreferencesJson(client.matchPreferencesJson);
    const clientMatchTokens = new Set(clientPreferenceSearchTokens(matchPrefs));

    const types: string[] = [];
    if (prefs.showTextPosts) types.push("TEXT");
    if (prefs.showImagePosts) {
      types.push("IMAGE", "CAROUSEL");
    }
    if (prefs.showVideoPosts) types.push("VIDEO");
    if (!types.length) types.push("TEXT");

    const [savedRows, fithubBlockedTrainerIds] = await Promise.all([
      prisma.clientSavedTrainer.findMany({
        where: { clientId },
        select: { trainerId: true },
      }),
      getTrainerIdsHiddenFromClientFithub(clientId),
    ]);
    const savedIds = new Set(savedRows.map((r) => r.trainerId));

    const blockedList = [...fithubBlockedTrainerIds];
    const where: Prisma.TrainerFitHubPostWhereInput = {
      AND: [
        { postType: { in: types } },
        fithubPublicFeedVisibilityWhere(),
        ...(blockedList.length ? [{ trainerId: { notIn: blockedList } }] : []),
        ...(prefs.feedStyle === "SAVED_COACHES_ONLY"
          ? !savedIds.size
            ? []
            : [{ trainerId: { in: [...savedIds] } }]
          : []),
      ],
    };
    if (prefs.feedStyle === "SAVED_COACHES_ONLY" && !savedIds.size) {
      return NextResponse.json({
        posts: [],
        feedEmptyReason: "SAVED_COACHES_ONLY",
        preferences: prefs,
      });
    }

    // Fetch extra rows when we will dedupe by trainer so we can still return up to `limit` unique trainers.
    const limit = 60;
    const takeRaw =
      prefs.feedStyle === "ALGORITHMIC" || prefs.hideRepeatedTrainers ? 180 : limit;
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

    const clientZipPrefix = clientZipToPrefix(client.zipCode);
    const promotionMap = await loadActivePromotionsForPosts(
      rows.map((r) => r.id),
    );
    function promotionBoostFor(postId: string): number {
      const pr = promotionMap.get(postId);
      if (!pr) return 0;
      return promotionRegionalFeedBoost(
        pr.tokensSpent,
        pr.durationDays,
        pr.regionZipPrefix,
        clientZipPrefix,
      );
    }

    let sorted = [...rows];
    if (prefs.feedStyle === "NEWEST" || prefs.feedStyle === "SAVED_COACHES_ONLY") {
      sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } else {
      sorted.sort(
        (a, b) =>
          scorePost(b, prefs, savedIds, clientMatchTokens, promotionBoostFor(b.id)) -
          scorePost(a, prefs, savedIds, clientMatchTokens, promotionBoostFor(a.id)),
      );
    }

    sorted = applyFeedLengthCap(sorted, prefs.hideRepeatedTrainers, limit);

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
