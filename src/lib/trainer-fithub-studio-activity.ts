import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const FITHUB_STUDIO_DIGEST_TITLE = "FITHUB: NEW INTERACTIONS";

/** Max stored per-item read keys (FIFO trim on append). */
export const FITHUB_STUDIO_READ_KEYS_MAX = 2500;

export type FitHubStudioActivityKind = "LIKE" | "COMMENT" | "REPOST" | "SHARE";

export type FitHubStudioActivityItem = {
  id: string;
  kind: FitHubStudioActivityKind;
  createdAt: string;
  postId: string;
  postPreview: string | null;
  actorLabel: string;
  body?: string;
  read: boolean;
};

function clientLabel(firstName: string | null, preferredName: string | null): string {
  const p = preferredName?.trim();
  if (p) return p;
  const f = firstName?.trim();
  if (f) return f;
  return "Member";
}

export async function getTrainerFitHubStudioSeenAt(trainerId: string): Promise<Date | null> {
  const row = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: { fitHubStudioActivitySeenAt: true },
  });
  return row?.fitHubStudioActivitySeenAt ?? null;
}

export async function getTrainerFitHubStudioReadKeys(trainerId: string): Promise<Set<string>> {
  const row = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: { fitHubStudioActivityReadKeysJson: true },
  });
  const raw = row?.fitHubStudioActivityReadKeysJson?.trim();
  if (!raw) return new Set();
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return new Set();
    return new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0));
  } catch {
    return new Set();
  }
}

function splitReadKeysByKind(readKeys: Set<string>): {
  likeIds: string[];
  commentIds: string[];
  repostIds: string[];
  shareIds: string[];
} {
  const likeIds: string[] = [];
  const commentIds: string[] = [];
  const repostIds: string[] = [];
  const shareIds: string[] = [];
  for (const k of readKeys) {
    if (k.startsWith("like-")) likeIds.push(k.slice("like-".length));
    else if (k.startsWith("comment-")) commentIds.push(k.slice("comment-".length));
    else if (k.startsWith("repost-")) repostIds.push(k.slice("repost-".length));
    else if (k.startsWith("share-")) shareIds.push(k.slice("share-".length));
  }
  return { likeIds, commentIds, repostIds, shareIds };
}

export async function appendTrainerFitHubStudioReadKeys(trainerId: string, keys: string[]): Promise<void> {
  if (!keys.length) return;
  const existing = await getTrainerFitHubStudioReadKeys(trainerId);
  for (const k of keys) existing.add(k);
  let arr = [...existing];
  if (arr.length > FITHUB_STUDIO_READ_KEYS_MAX) {
    arr = arr.slice(-FITHUB_STUDIO_READ_KEYS_MAX);
  }
  await prisma.trainerProfile.update({
    where: { trainerId },
    data: { fitHubStudioActivityReadKeysJson: JSON.stringify(arr) },
  });
}

export async function markTrainerFitHubStudioActivitySeen(trainerId: string): Promise<void> {
  await prisma.trainerProfile.update({
    where: { trainerId },
    data: {
      fitHubStudioActivitySeenAt: new Date(),
      fitHubStudioActivityReadKeysJson: JSON.stringify([]),
    },
  });
}

function isStudioActivityItemRead(
  item: { id: string; createdAt: string },
  seenAt: Date | null,
  readKeys: Set<string>,
): boolean {
  if (readKeys.has(item.id)) return true;
  if (seenAt) return new Date(item.createdAt).getTime() <= seenAt.getTime();
  return false;
}

export async function countTrainerFitHubUnseenInteractions(trainerId: string): Promise<number> {
  const [seen, readKeys] = await Promise.all([
    getTrainerFitHubStudioSeenAt(trainerId),
    getTrainerFitHubStudioReadKeys(trainerId),
  ]);
  const since = seen ?? new Date(0);
  const { likeIds, commentIds, repostIds, shareIds } = splitReadKeysByKind(readKeys);

  const postWhere = { trainerId };

  const likeWhere: Prisma.TrainerFitHubPostLikeWhereInput = {
    post: postWhere,
    createdAt: { gt: since },
    ...(likeIds.length ? { id: { notIn: likeIds } } : {}),
  };
  const commentWhere: Prisma.TrainerFitHubCommentWhereInput = {
    post: postWhere,
    createdAt: { gt: since },
    ...(commentIds.length ? { id: { notIn: commentIds } } : {}),
  };
  const repostWhere: Prisma.ClientFitHubRepostWhereInput = {
    post: postWhere,
    createdAt: { gt: since },
    ...(repostIds.length ? { id: { notIn: repostIds } } : {}),
  };
  const shareWhere: Prisma.ClientFitHubPostShareWhereInput = {
    post: postWhere,
    createdAt: { gt: since },
    ...(shareIds.length ? { id: { notIn: shareIds } } : {}),
  };

  const [likes, comments, reposts, shares] = await Promise.all([
    prisma.trainerFitHubPostLike.count({ where: likeWhere }),
    prisma.trainerFitHubComment.count({ where: commentWhere }),
    prisma.clientFitHubRepost.count({ where: repostWhere }),
    prisma.clientFitHubPostShare.count({ where: shareWhere }),
  ]);

  return likes + comments + reposts + shares;
}

/** When unseen FitHub interactions exceed 9, add one unread digest row (deduped). */
export async function ensureFitHubStudioDigestTrainerNotification(trainerId: string): Promise<void> {
  const premium = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: { premiumStudioEnabledAt: true },
  });
  if (!premium?.premiumStudioEnabledAt) return;

  const unseen = await countTrainerFitHubUnseenInteractions(trainerId);
  if (unseen <= 9) return;

  const existing = await prisma.trainerNotification.findFirst({
    where: {
      trainerId,
      readAt: null,
      title: FITHUB_STUDIO_DIGEST_TITLE,
    },
    select: { id: true },
  });
  if (existing) return;

  await prisma.trainerNotification.create({
    data: {
      trainerId,
      kind: "PLATFORM",
      title: FITHUB_STUDIO_DIGEST_TITLE,
      body: `You have more than nine new FitHub interactions since you last checked the studio. Open Premium → FitHub & Content to review likes, comments, reposts, and shares.`,
      linkHref: "/trainer/dashboard/premium/fit-hub-content",
    },
  });
}

export async function listTrainerFitHubStudioActivity(
  trainerId: string,
  filter: "ALL" | FitHubStudioActivityKind,
  limit = 120,
  readState?: { readKeys: Set<string>; seenAt: Date | null },
): Promise<FitHubStudioActivityItem[]> {
  const postSelect = { id: true, caption: true, bodyText: true };

  const [likes, comments, reposts, shares] = await Promise.all([
    filter === "ALL" || filter === "LIKE"
      ? prisma.trainerFitHubPostLike.findMany({
          where: { post: { trainerId } },
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            id: true,
            createdAt: true,
            post: { select: postSelect },
            client: { select: { firstName: true, preferredName: true } },
          },
        })
      : [],
    filter === "ALL" || filter === "COMMENT"
      ? prisma.trainerFitHubComment.findMany({
          where: { post: { trainerId } },
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            id: true,
            createdAt: true,
            body: true,
            post: { select: postSelect },
            client: { select: { firstName: true, preferredName: true } },
          },
        })
      : [],
    filter === "ALL" || filter === "REPOST"
      ? prisma.clientFitHubRepost.findMany({
          where: { post: { trainerId } },
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            id: true,
            createdAt: true,
            post: { select: postSelect },
            client: { select: { firstName: true, preferredName: true } },
          },
        })
      : [],
    filter === "ALL" || filter === "SHARE"
      ? prisma.clientFitHubPostShare.findMany({
          where: { post: { trainerId } },
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            id: true,
            createdAt: true,
            post: { select: postSelect },
            client: { select: { firstName: true, preferredName: true } },
          },
        })
      : [],
  ]);

  const out: FitHubStudioActivityItem[] = [];

  const rk = readState?.readKeys ?? new Set<string>();
  const seenAt = readState?.seenAt ?? null;

  for (const row of likes) {
    const item = {
      id: `like-${row.id}`,
      kind: "LIKE" as const,
      createdAt: row.createdAt.toISOString(),
      postId: row.post.id,
      postPreview: row.post.caption ?? row.post.bodyText,
      actorLabel: clientLabel(row.client.firstName, row.client.preferredName),
    };
    out.push({ ...item, read: isStudioActivityItemRead(item, seenAt, rk) });
  }
  for (const row of comments) {
    const item = {
      id: `comment-${row.id}`,
      kind: "COMMENT" as const,
      createdAt: row.createdAt.toISOString(),
      postId: row.post.id,
      postPreview: row.post.caption ?? row.post.bodyText,
      actorLabel: clientLabel(row.client.firstName, row.client.preferredName),
      body: row.body,
    };
    out.push({ ...item, read: isStudioActivityItemRead(item, seenAt, rk) });
  }
  for (const row of reposts) {
    const item = {
      id: `repost-${row.id}`,
      kind: "REPOST" as const,
      createdAt: row.createdAt.toISOString(),
      postId: row.post.id,
      postPreview: row.post.caption ?? row.post.bodyText,
      actorLabel: clientLabel(row.client.firstName, row.client.preferredName),
    };
    out.push({ ...item, read: isStudioActivityItemRead(item, seenAt, rk) });
  }
  for (const row of shares) {
    const item = {
      id: `share-${row.id}`,
      kind: "SHARE" as const,
      createdAt: row.createdAt.toISOString(),
      postId: row.post.id,
      postPreview: row.post.caption ?? row.post.bodyText,
      actorLabel: clientLabel(row.client.firstName, row.client.preferredName),
    };
    out.push({ ...item, read: isStudioActivityItemRead(item, seenAt, rk) });
  }

  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  return out.slice(0, limit);
}

const STUDIO_ACTIVITY_ITEM_ID_RE = /^(like|comment|repost|share)-[a-z0-9_-]{1,80}$/i;

/** Validates client-supplied activity item ids before persisting read keys. */
export function sanitizeFitHubStudioActivityItemIds(raw: unknown, max = 80): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const t = x.trim();
    if (!STUDIO_ACTIVITY_ITEM_ID_RE.test(t)) continue;
    if (!out.includes(t)) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}
