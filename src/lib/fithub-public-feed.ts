import type { Prisma } from "@/generated/prisma/client";
import {
  isTrainerHiddenFromPublicMarketplace,
  publicMarketplaceVisibleTrainerWhere,
} from "@/lib/match-fit-public-marketplace-hidden";

/** Posts visible on client and trainer discovery FitHub feeds. */
export function fithubPublicFeedVisibilityWhere(): Prisma.TrainerFitHubPostWhereInput {
  const now = new Date();
  return {
    internalQaSandboxPost: false,
    demoSeedKey: null,
    visibility: "PUBLIC",
    OR: [{ scheduledPublishAt: null }, { scheduledPublishAt: { lte: now } }],
    trainer: publicMarketplaceVisibleTrainerWhere(),
  };
}

export function isFitHubPostPubliclyInteractable(post: {
  visibility: string;
  scheduledPublishAt: Date | null;
  internalQaSandboxPost?: boolean;
  demoSeedKey?: string | null;
  trainer?: {
    email: string;
    username: string;
    internalQaSyntheticPersona?: boolean | null;
  };
}): boolean {
  if (post.internalQaSandboxPost) return false;
  if (post.demoSeedKey) return false;
  if (post.visibility !== "PUBLIC") return false;
  const t = post.scheduledPublishAt?.getTime();
  if (t != null && t > Date.now()) return false;
  if (post.trainer && isTrainerHiddenFromPublicMarketplace(post.trainer)) return false;
  return true;
}

/** Prisma select for routes that gate FitHub interactions on public feed visibility. */
export const fithubPostPublicInteractSelect = {
  id: true,
  visibility: true,
  scheduledPublishAt: true,
  internalQaSandboxPost: true,
  demoSeedKey: true,
  trainer: {
    select: {
      email: true,
      username: true,
      internalQaSyntheticPersona: true,
    },
  },
} as const;
