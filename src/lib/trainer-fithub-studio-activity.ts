import { prisma } from "@/lib/prisma";

export const FITHUB_STUDIO_DIGEST_TITLE = "FITHUB: NEW INTERACTIONS";

export type FitHubStudioActivityKind = "LIKE" | "COMMENT" | "REPOST" | "SHARE";

export type FitHubStudioActivityItem = {
  id: string;
  kind: FitHubStudioActivityKind;
  createdAt: string;
  postId: string;
  postPreview: string | null;
  actorLabel: string;
  body?: string;
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

export async function markTrainerFitHubStudioActivitySeen(trainerId: string): Promise<void> {
  await prisma.trainerProfile.update({
    where: { trainerId },
    data: { fitHubStudioActivitySeenAt: new Date() },
  });
}

export async function countTrainerFitHubUnseenInteractions(trainerId: string): Promise<number> {
  const seen = await getTrainerFitHubStudioSeenAt(trainerId);
  const since = seen ?? new Date(0);

  const postWhere = { trainerId };

  const [likes, comments, reposts, shares] = await Promise.all([
    prisma.trainerFitHubPostLike.count({
      where: { post: postWhere, createdAt: { gt: since } },
    }),
    prisma.trainerFitHubComment.count({
      where: { post: postWhere, createdAt: { gt: since } },
    }),
    prisma.clientFitHubRepost.count({
      where: { post: postWhere, createdAt: { gt: since } },
    }),
    prisma.clientFitHubPostShare.count({
      where: { post: postWhere, createdAt: { gt: since } },
    }),
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

  for (const row of likes) {
    out.push({
      id: `like-${row.id}`,
      kind: "LIKE",
      createdAt: row.createdAt.toISOString(),
      postId: row.post.id,
      postPreview: row.post.caption ?? row.post.bodyText,
      actorLabel: clientLabel(row.client.firstName, row.client.preferredName),
    });
  }
  for (const row of comments) {
    out.push({
      id: `comment-${row.id}`,
      kind: "COMMENT",
      createdAt: row.createdAt.toISOString(),
      postId: row.post.id,
      postPreview: row.post.caption ?? row.post.bodyText,
      actorLabel: clientLabel(row.client.firstName, row.client.preferredName),
      body: row.body,
    });
  }
  for (const row of reposts) {
    out.push({
      id: `repost-${row.id}`,
      kind: "REPOST",
      createdAt: row.createdAt.toISOString(),
      postId: row.post.id,
      postPreview: row.post.caption ?? row.post.bodyText,
      actorLabel: clientLabel(row.client.firstName, row.client.preferredName),
    });
  }
  for (const row of shares) {
    out.push({
      id: `share-${row.id}`,
      kind: "SHARE",
      createdAt: row.createdAt.toISOString(),
      postId: row.post.id,
      postPreview: row.post.caption ?? row.post.bodyText,
      actorLabel: clientLabel(row.client.firstName, row.client.preferredName),
    });
  }

  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  return out.slice(0, limit);
}
