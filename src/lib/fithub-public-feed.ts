import type { Prisma } from "@prisma/client";

/** Posts visible on client and trainer discovery FitHub feeds. */
export function fithubPublicFeedVisibilityWhere(): Prisma.TrainerFitHubPostWhereInput {
  const now = new Date();
  return {
    visibility: "PUBLIC",
    OR: [{ scheduledPublishAt: null }, { scheduledPublishAt: { lte: now } }],
  };
}

export function isFitHubPostPubliclyInteractable(post: {
  visibility: string;
  scheduledPublishAt: Date | null;
}): boolean {
  if (post.visibility !== "PUBLIC") return false;
  const t = post.scheduledPublishAt?.getTime();
  if (t != null && t > Date.now()) return false;
  return true;
}
