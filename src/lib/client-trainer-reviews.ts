import { prisma } from "@/lib/prisma";
import { moderateClientTrainerTestimonial } from "@/lib/client-trainer-review-moderation";
import { grantFiveStarReviewTokensIfEligibleInTx } from "@/lib/trainer-promo-tokens";

/** Reviews that count toward the public “last 10” window and star average on the coach profile. */
export const TRAINER_PUBLIC_REVIEW_WINDOW = 10;

export type TrainerPublicReviewItem = {
  id: string;
  stars: number;
  testimonialText: string | null;
  createdAt: string;
};

export type TrainerPublicReviewSummary = {
  /** Average of up to the latest ten non-removed reviews (null when none). */
  averageStars: number | null;
  /** How many reviews are included in `averageStars` (min 1, max 10). */
  windowCount: number;
  /** Latest reviews visible on the public profile (same window). */
  items: TrainerPublicReviewItem[];
};

export async function clientMayReviewTrainer(clientId: string, trainerId: string): Promise<boolean> {
  const [conv, txCount] = await Promise.all([
    prisma.trainerClientConversation.findUnique({
      where: { trainerId_clientId: { trainerId, clientId } },
      select: { officialChatStartedAt: true },
    }),
    prisma.trainerClientServiceTransaction.count({ where: { clientId, trainerId } }),
  ]);
  if (txCount > 0) return true;
  return Boolean(conv?.officialChatStartedAt);
}

export async function getTrainerPublicReviewSummary(trainerId: string): Promise<TrainerPublicReviewSummary> {
  const rows = await prisma.clientTrainerReview.findMany({
    where: { trainerId, removedByClientAt: null },
    orderBy: { createdAt: "desc" },
    take: TRAINER_PUBLIC_REVIEW_WINDOW,
    select: {
      id: true,
      stars: true,
      testimonialText: true,
      createdAt: true,
    },
  });
  if (rows.length === 0) {
    return { averageStars: null, windowCount: 0, items: [] };
  }
  const sum = rows.reduce((acc, r) => acc + r.stars, 0);
  const averageStars = Math.round((sum / rows.length) * 10) / 10;
  return {
    averageStars,
    windowCount: rows.length,
    items: rows.map((r) => ({
      id: r.id,
      stars: r.stars,
      testimonialText: r.testimonialText,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function getActiveClientTrainerReview(clientId: string, trainerId: string) {
  return prisma.clientTrainerReview.findFirst({
    where: { clientId, trainerId, removedByClientAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      stars: true,
      testimonialText: true,
      testimonialModeratedAt: true,
      trainerRemovalRequestedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export type UpsertClientTrainerReviewResult =
  | {
      ok: true;
      review: {
        id: string;
        stars: number;
        testimonialText: string | null;
        testimonialModeratedAt: string | null;
        trainerRemovalRequestedAt: string | null;
        createdAt: string;
        updatedAt: string;
      };
      testimonialModerated: boolean;
      fiveStarTokensGranted: boolean;
    }
  | { ok: false; error: string };

export async function upsertClientTrainerReviewForPair(args: {
  clientId: string;
  trainerId: string;
  stars: number;
  testimonialRaw: string | null | undefined;
}): Promise<UpsertClientTrainerReviewResult> {
  const eligible = await clientMayReviewTrainer(args.clientId, args.trainerId);
  if (!eligible) {
    return { ok: false, error: "You can leave a review after messaging this coach or completing a session with them on Match Fit." };
  }

  const mod = moderateClientTrainerTestimonial(args.testimonialRaw);
  const testimonialModeratedAt = mod.testimonialModerated ? new Date() : null;

  const active = await prisma.clientTrainerReview.findFirst({
    where: { clientId: args.clientId, trainerId: args.trainerId, removedByClientAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
    },
  });

  let fiveStarTokensGranted = false;

  const saved = await prisma.$transaction(async (tx) => {
    let reviewId: string;
    if (active) {
      reviewId = active.id;
      await tx.clientTrainerReview.update({
        where: { id: active.id },
        data: {
          stars: args.stars,
          testimonialText: mod.testimonialText,
          testimonialModeratedAt,
          trainerRemovalRequestedAt: null,
          updatedAt: new Date(),
        },
      });
    } else {
      const created = await tx.clientTrainerReview.create({
        data: {
          clientId: args.clientId,
          trainerId: args.trainerId,
          stars: args.stars,
          testimonialText: mod.testimonialText,
          testimonialModeratedAt,
        },
        select: { id: true },
      });
      reviewId = created.id;
    }

    const pre = await tx.clientTrainerReview.findUnique({
      where: { id: reviewId },
      select: { fiveStarTokensGrantedAt: true },
    });
    const hadFiveStarCredit = Boolean(pre?.fiveStarTokensGrantedAt);

    await grantFiveStarReviewTokensIfEligibleInTx(
      tx,
      args.trainerId,
      reviewId,
      args.stars,
      pre?.fiveStarTokensGrantedAt ?? null,
    );

    const post = await tx.clientTrainerReview.findUnique({
      where: { id: reviewId },
      select: { fiveStarTokensGrantedAt: true },
    });
    fiveStarTokensGranted = !hadFiveStarCredit && Boolean(post?.fiveStarTokensGrantedAt);

    return tx.clientTrainerReview.findUniqueOrThrow({
      where: { id: reviewId },
      select: {
        id: true,
        stars: true,
        testimonialText: true,
        testimonialModeratedAt: true,
        trainerRemovalRequestedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  if (!active) {
    await prisma.trainerNotification.create({
      data: {
        trainerId: args.trainerId,
        kind: "PLATFORM",
        title: "NEW CLIENT REVIEW",
        body:
          args.stars === 5
            ? "A client left you a five-star review on Match Fit."
            : `A client left you a ${args.stars}-star review on Match Fit.`,
        linkHref: "/trainer/dashboard/reviews",
      },
    });
  }

  return {
    ok: true,
    review: {
      id: saved.id,
      stars: saved.stars,
      testimonialText: saved.testimonialText,
      testimonialModeratedAt: saved.testimonialModeratedAt?.toISOString() ?? null,
      trainerRemovalRequestedAt: saved.trainerRemovalRequestedAt?.toISOString() ?? null,
      createdAt: saved.createdAt.toISOString(),
      updatedAt: saved.updatedAt.toISOString(),
    },
    testimonialModerated: mod.testimonialModerated,
    fiveStarTokensGranted,
  };
}

export async function softRemoveClientTrainerReview(args: {
  clientId: string;
  trainerId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const active = await prisma.clientTrainerReview.findFirst({
    where: { clientId: args.clientId, trainerId: args.trainerId, removedByClientAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!active) {
    return { ok: false, error: "No active review to remove." };
  }
  await prisma.clientTrainerReview.update({
    where: { id: active.id },
    data: { removedByClientAt: new Date() },
  });
  return { ok: true };
}

export async function trainerRequestReviewRemoval(args: {
  trainerId: string;
  reviewId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await prisma.clientTrainerReview.findFirst({
    where: { id: args.reviewId, trainerId: args.trainerId },
    select: {
      id: true,
      stars: true,
      clientId: true,
      trainerRemovalRequestedAt: true,
      removedByClientAt: true,
      trainer: { select: { username: true, preferredName: true, firstName: true, lastName: true } },
    },
  });
  if (!row || row.removedByClientAt) {
    return { ok: false, error: "Review not found." };
  }
  if (row.stars > 2) {
    return { ok: false, error: "You can only ask clients to edit or remove one- and two-star reviews." };
  }
  if (row.trainerRemovalRequestedAt) {
    return { ok: false, error: "You already asked this client to update or remove this review." };
  }
  const coachName =
    row.trainer.preferredName?.trim() ||
    [row.trainer.firstName, row.trainer.lastName].filter(Boolean).join(" ").trim() ||
    "Your coach";

  await prisma.$transaction([
    prisma.clientTrainerReview.update({
      where: { id: row.id },
      data: { trainerRemovalRequestedAt: new Date() },
    }),
    prisma.clientNotification.create({
      data: {
        clientId: row.clientId,
        kind: "SYSTEM",
        title: "Coach review request",
        body: `${coachName} asked you to edit or remove your review. Only you can change it from your Match Fit account.`,
        linkHref: `/trainers/${encodeURIComponent(row.trainer.username)}#coach-review`,
      },
    }),
  ]);

  return { ok: true };
}

export type TrainerDashboardReviewRow = {
  id: string;
  stars: number;
  testimonialText: string | null;
  testimonialModeratedAt: string | null;
  createdAt: string;
  removedByClientAt: string | null;
  trainerRemovalRequestedAt: string | null;
  inPublicWindow: boolean;
  clientUsername: string;
  clientDisplayName: string;
};

export async function listTrainerDashboardReviews(trainerId: string): Promise<{
  visible: TrainerDashboardReviewRow[];
  archived: TrainerDashboardReviewRow[];
  profileAverageStars: number | null;
  profileWindowCount: number;
}> {
  const publicWindowIds = new Set(
    (
      await prisma.clientTrainerReview.findMany({
        where: { trainerId, removedByClientAt: null },
        orderBy: { createdAt: "desc" },
        take: TRAINER_PUBLIC_REVIEW_WINDOW,
        select: { id: true },
      })
    ).map((r) => r.id),
  );

  const all = await prisma.clientTrainerReview.findMany({
    where: { trainerId, removedByClientAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      stars: true,
      testimonialText: true,
      testimonialModeratedAt: true,
      createdAt: true,
      removedByClientAt: true,
      trainerRemovalRequestedAt: true,
      client: {
        select: { username: true, preferredName: true, firstName: true, lastName: true },
      },
    },
  });

  const toRow = (r: (typeof all)[number]): TrainerDashboardReviewRow => ({
    id: r.id,
    stars: r.stars,
    testimonialText: r.testimonialText,
    testimonialModeratedAt: r.testimonialModeratedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    removedByClientAt: r.removedByClientAt?.toISOString() ?? null,
    trainerRemovalRequestedAt: r.trainerRemovalRequestedAt?.toISOString() ?? null,
    inPublicWindow: publicWindowIds.has(r.id),
    clientUsername: r.client.username,
    clientDisplayName:
      r.client.preferredName?.trim() ||
      [r.client.firstName, r.client.lastName].filter(Boolean).join(" ").trim() ||
      r.client.username,
  });

  const activeRows = all.map((r) => toRow(r));

  const visible = activeRows.filter((r) => r.inPublicWindow);
  const archived = activeRows.filter((r) => !r.inPublicWindow);

  const windowStars = visible.map((r) => r.stars);
  const profileAverageStars =
    windowStars.length > 0 ? Math.round((windowStars.reduce((a, b) => a + b, 0) / windowStars.length) * 10) / 10 : null;

  return {
    visible,
    archived,
    profileAverageStars,
    profileWindowCount: visible.length,
  };
}
