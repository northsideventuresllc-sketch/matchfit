import type { Prisma } from "@/generated/prisma/client";

/** Posts visible on client and trainer discovery FitHub feeds. */
export function fithubPublicFeedVisibilityWhere(): Prisma.TrainerFitHubPostWhereInput {
  const now = new Date();
  return {
    internalQaSandboxPost: false,
    visibility: "PUBLIC",
    OR: [{ scheduledPublishAt: null }, { scheduledPublishAt: { lte: now } }],
  };
}

export function isFitHubPostPubliclyInteractable(post: {
  visibility: string;
  scheduledPublishAt: Date | null;
  internalQaSandboxPost?: boolean;
}): boolean {
  if (post.internalQaSandboxPost) return false;
  if (post.visibility !== "PUBLIC") return false;
  const t = post.scheduledPublishAt?.getTime();
  if (t != null && t > Date.now()) return false;
  return true;
}
