import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { clientZipToPrefix, trainerMatchAnswersToRegionZipPrefix } from "@/lib/featured-region";
import { isTrainerPremiumStudioActive } from "@/lib/trainer-premium-studio";

export const TOKENS_PER_USD_PACK = 20;
export const USD_PACK_PRICE_CENTS = 500;
/** Checkout tiers (Stripe uses `packTier` metadata). Legacy checkouts used `packCount` × TOKENS_PER_USD_PACK. */
export const PROMO_TOKEN_PACK_TIERS = [
  { id: "starter", tokens: 20, usdCents: 500, label: "Starter" },
  { id: "growth", tokens: 100, usdCents: 2000, label: "Growth" },
  { id: "scale", tokens: 1000, usdCents: 8000, label: "Scale" },
] as const;

export type PromoTokenPackTierId = (typeof PROMO_TOKEN_PACK_TIERS)[number]["id"];

export function getPromoPackTierById(id: string): (typeof PROMO_TOKEN_PACK_TIERS)[number] | null {
  return PROMO_TOKEN_PACK_TIERS.find((t) => t.id === id) ?? null;
}

export const WEEKLY_PREMIUM_TRAINER_GRANT = 20;
export const SALE_COMPLETED_TRAINER_REWARD = 10;
export const MIN_PROMO_TOKENS_PER_DAY = 20;
export const MAX_CLIENT_GIFT_TO_TRAINER_PER_WEEK = 100;
export const MAX_PROMO_DURATION_DAYS = 30;
export const MAX_SINGLE_PROMOTION_TOKENS = 20_000;
export const SUGGESTED_CLIENT_GIFT_AMOUNT = 20;

export type TrainerTokenLedgerReason =
  | "WEEKLY_GRANT"
  | "SALE_REWARD"
  | "STRIPE_PURCHASE"
  | "CLIENT_GIFT"
  | "PROMOTION_SPEND"
  | "ADMIN_ADJUST";

type Tx = Prisma.TransactionClient;

/** ISO week key (e.g. 2026-W18) for Monday-based week in America/New_York. */
export function newYorkIsoWeekKey(now = new Date()): string {
  const cal = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const [y, m, d] = cal.split("-").map((x) => parseInt(x, 10));
  const utcNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dayNum = utcNoon.getUTCDay() || 7;
  utcNoon.setUTCDate(utcNoon.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcNoon.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((utcNoon.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${utcNoon.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export async function applyTrainerTokenDelta(
  tx: Tx,
  trainerId: string,
  delta: number,
  reason: TrainerTokenLedgerReason,
  referenceKey: string | null,
  metaJson?: string | null,
): Promise<void> {
  if (delta === 0) return;
  const prev = await tx.trainerTokenBalance.findUnique({
    where: { trainerId },
    select: { balance: true },
  });
  const next = (prev?.balance ?? 0) + delta;
  if (next < 0) {
    const err = new Error("INSUFFICIENT_TOKENS");
    (err as Error & { code: string }).code = "INSUFFICIENT_TOKENS";
    throw err;
  }
  await tx.trainerTokenBalance.upsert({
    where: { trainerId },
    create: { trainerId, balance: next },
    update: { balance: next },
  });
  await tx.trainerTokenLedgerEntry.create({
    data: {
      trainerId,
      delta,
      reason,
      referenceKey: referenceKey ?? undefined,
      metaJson: metaJson ?? undefined,
    },
  });
}

export async function getTrainerTokenBalance(trainerId: string): Promise<number> {
  const row = await prisma.trainerTokenBalance.findUnique({
    where: { trainerId },
    select: { balance: true },
  });
  return row?.balance ?? 0;
}

export async function ensureWeeklyPremiumTrainerGrant(trainerId: string): Promise<void> {
  if (!(await isTrainerPremiumStudioActive(trainerId))) return;
  const weekKey = newYorkIsoWeekKey();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.trainerWeeklyTokenGrant.create({
        data: { trainerId, weekKey },
      });
      await applyTrainerTokenDelta(tx, trainerId, WEEKLY_PREMIUM_TRAINER_GRANT, "WEEKLY_GRANT", weekKey, null);
    });
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "P2002") return;
    throw e;
  }
}

export async function backfillUngrantedSaleRewardsForTrainer(trainerId: string): Promise<void> {
  if (!(await isTrainerPremiumStudioActive(trainerId))) return;
  const pending = await prisma.trainerClientServiceTransaction.findMany({
    where: { trainerId, trainerSaleTokensGrantedAt: null },
    select: { id: true },
    take: 50,
  });
  for (const row of pending) {
    await grantSaleTokensForServiceTransaction(row.id);
  }
}

export async function grantSaleTokensForServiceTransaction(transactionId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const trx = await tx.trainerClientServiceTransaction.findUnique({
      where: { id: transactionId },
      select: {
        trainerId: true,
        trainerSaleTokensGrantedAt: true,
      },
    });
    if (!trx || trx.trainerSaleTokensGrantedAt) return;
    const premium = await tx.trainerProfile.findUnique({
      where: { trainerId: trx.trainerId },
      select: { premiumStudioEnabledAt: true },
    });
    if (!premium?.premiumStudioEnabledAt) return;
    await applyTrainerTokenDelta(
      tx,
      trx.trainerId,
      SALE_COMPLETED_TRAINER_REWARD,
      "SALE_REWARD",
      `sale:${transactionId}`,
      null,
    );
    await tx.trainerClientServiceTransaction.update({
      where: { id: transactionId },
      data: { trainerSaleTokensGrantedAt: new Date() },
    });
  });
}

export async function creditTokensFromStripePurchase(
  trainerId: string,
  stripeCheckoutSessionId: string,
  tokenAmount: number,
): Promise<{ credited: number } | { skipped: true }> {
  const tokens = Math.floor(tokenAmount);
  if (tokens <= 0) return { skipped: true };
  const result = await prisma.$transaction(async (tx) => {
    const dup = await tx.trainerTokenLedgerEntry.findFirst({
      where: { trainerId, reason: "STRIPE_PURCHASE", referenceKey: stripeCheckoutSessionId },
      select: { id: true },
    });
    if (dup) return { skipped: true as const };
    await applyTrainerTokenDelta(tx, trainerId, tokens, "STRIPE_PURCHASE", stripeCheckoutSessionId, null);
    return { credited: tokens };
  });
  return result;
}

export function promotionRegionalFeedBoost(
  tokensSpent: number,
  durationDays: number,
  promoRegionPrefix: string,
  clientZipPrefix: string | null,
): number {
  if (!clientZipPrefix || promoRegionPrefix !== clientZipPrefix) return 0;
  const perDay = tokensSpent / Math.max(1, durationDays);
  return Math.min(160, Math.floor(perDay * 1.4 + tokensSpent * 0.035));
}

export async function loadActivePromotionsForPosts(
  postIds: string[],
  now = new Date(),
): Promise<Map<string, { tokensSpent: number; durationDays: number; regionZipPrefix: string }>> {
  const map = new Map<string, { tokensSpent: number; durationDays: number; regionZipPrefix: string }>();
  if (!postIds.length) return map;
  const promos = await prisma.trainerFitHubPostPromotion.findMany({
    where: {
      postId: { in: postIds },
      startsAt: { lte: now },
      endsAt: { gt: now },
    },
    select: {
      postId: true,
      tokensSpent: true,
      durationDays: true,
      regionZipPrefix: true,
    },
  });
  for (const p of promos) {
    const cur = map.get(p.postId);
    const score = p.tokensSpent * 1000 + p.durationDays;
    const prevScore = cur ? cur.tokensSpent * 1000 + cur.durationDays : -1;
    if (!cur || score > prevScore) {
      map.set(p.postId, {
        tokensSpent: p.tokensSpent,
        durationDays: p.durationDays,
        regionZipPrefix: p.regionZipPrefix,
      });
    }
  }
  return map;
}

export async function getPostEngagementBetween(postId: string, rangeStart: Date, rangeEnd: Date) {
  const [likes, comments, reposts, shares] = await Promise.all([
    prisma.trainerFitHubPostLike.count({
      where: { postId, createdAt: { gte: rangeStart, lte: rangeEnd } },
    }),
    prisma.trainerFitHubComment.count({
      where: { postId, createdAt: { gte: rangeStart, lte: rangeEnd } },
    }),
    prisma.clientFitHubRepost.count({
      where: { postId, createdAt: { gte: rangeStart, lte: rangeEnd } },
    }),
    prisma.clientFitHubPostShare.count({
      where: { postId, createdAt: { gte: rangeStart, lte: rangeEnd } },
    }),
  ]);
  return { likes, comments, reposts, shares };
}

export function promotionPhase(startsAt: Date, endsAt: Date, now = new Date()): "scheduled" | "current" | "past" {
  if (startsAt > now) return "scheduled";
  if (endsAt <= now) return "past";
  return "current";
}

export async function createVideoPromotion(args: {
  trainerId: string;
  postId: string;
  durationDays: number;
  tokensBudget: number;
  /** When set in the future, promotion is scheduled; tokens are still debited at creation. */
  scheduledStartsAt?: Date | null;
}): Promise<{ ok: true; promotionId: string } | { error: string }> {
  const { trainerId, postId, durationDays, tokensBudget, scheduledStartsAt } = args;
  if (!(await isTrainerPremiumStudioActive(trainerId))) {
    return { error: "Premium Hub is required for promotion tokens." };
  }
  if (durationDays < 1 || durationDays > MAX_PROMO_DURATION_DAYS) {
    return { error: `Duration must be between 1 and ${MAX_PROMO_DURATION_DAYS} days.` };
  }
  if (tokensBudget < MIN_PROMO_TOKENS_PER_DAY * durationDays) {
    return {
      error: `Minimum spend is ${MIN_PROMO_TOKENS_PER_DAY} tokens per day (${MIN_PROMO_TOKENS_PER_DAY * durationDays} tokens for ${durationDays} day(s)).`,
    };
  }
  if (tokensBudget > MAX_SINGLE_PROMOTION_TOKENS) {
    return { error: `Maximum tokens per promotion is ${MAX_SINGLE_PROMOTION_TOKENS}.` };
  }
  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      profile: { select: { matchQuestionnaireAnswers: true } },
    },
  });
  const region = trainerMatchAnswersToRegionZipPrefix(trainer?.profile?.matchQuestionnaireAnswers ?? null);
  if (!region) {
    return {
      error:
        "Set your in-person service ZIP in the Match questionnaire so regional boosts can apply. Virtual-only coaches cannot use regional video boosts.",
    };
  }
  const post = await prisma.trainerFitHubPost.findFirst({
    where: { id: postId, trainerId },
    select: { id: true, postType: true, visibility: true },
  });
  if (!post) return { error: "Post not found." };
  if (post.postType !== "VIDEO") {
    return { error: "Only VIDEO posts can be boosted with promotion tokens." };
  }
  if (post.visibility !== "PUBLIC") {
    return { error: "Only public posts can be promoted to the client feed." };
  }
  const now = new Date();
  let startsAt = now;
  if (scheduledStartsAt) {
    if (scheduledStartsAt.getTime() <= now.getTime() + 60_000) {
      return { error: "Scheduled start must be at least one minute from now." };
    }
    const maxLeadMs = 90 * 86400000;
    if (scheduledStartsAt.getTime() > now.getTime() + maxLeadMs) {
      return { error: "Cannot schedule more than 90 days ahead." };
    }
    startsAt = scheduledStartsAt;
  }
  const endsAt = new Date(startsAt.getTime() + durationDays * 86400000);

  const overlap = await prisma.trainerFitHubPostPromotion.findFirst({
    where: {
      postId,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: { id: true },
  });
  if (overlap) {
    return {
      error:
        "This post already has a promotion that overlaps these dates. Wait for it to finish, adjust the schedule, or pick another post.",
    };
  }
  try {
    const promotionId = await prisma.$transaction(async (tx) => {
      const id = randomUUID();
      await applyTrainerTokenDelta(
        tx,
        trainerId,
        -tokensBudget,
        "PROMOTION_SPEND",
        `promotion:${id}`,
        JSON.stringify({ postId, durationDays, scheduled: Boolean(scheduledStartsAt) }),
      );
      await tx.trainerFitHubPostPromotion.create({
        data: {
          id,
          postId,
          trainerId,
          tokensSpent: tokensBudget,
          durationDays,
          regionZipPrefix: region,
          startsAt,
          endsAt,
        },
      });
      return id;
    });
    return { ok: true, promotionId };
  } catch (e) {
    if ((e as Error & { code?: string }).code === "INSUFFICIENT_TOKENS") {
      return { error: "Not enough tokens for this promotion." };
    }
    throw e;
  }
}

export async function getClientTrainerGiftSumThisWeek(
  clientId: string,
  trainerId: string,
  weekKey = newYorkIsoWeekKey(),
): Promise<number> {
  const agg = await prisma.clientTrainerTokenGift.aggregate({
    where: { clientId, trainerId, weekKey },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

export async function clientGiftTokensToTrainer(args: {
  clientId: string;
  trainerUsername: string;
  amount: number;
  /** When set, posts a short line in the trainer–client thread in the same DB transaction. */
  announceConversationId?: string | null;
}): Promise<{ ok: true } | { error: string }> {
  const { clientId, trainerUsername, amount, announceConversationId } = args;
  if (!Number.isInteger(amount) || amount < 1) {
    return { error: "Amount must be a positive whole number." };
  }
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { stripeSubscriptionActive: true, safetySuspended: true },
  });
  if (!client || client.safetySuspended) {
    return { error: "Account not eligible to send tokens." };
  }
  if (!client.stripeSubscriptionActive) {
    return { error: "An active Match Fit subscription is required to send appreciation tokens." };
  }
  const trainer = await prisma.trainer.findUnique({
    where: { username: trainerUsername.trim() },
    select: {
      id: true,
      safetySuspended: true,
      profile: { select: { premiumStudioEnabledAt: true, dashboardActivatedAt: true } },
    },
  });
  if (!trainer?.profile?.dashboardActivatedAt || trainer.safetySuspended) {
    return { error: "Coach not found." };
  }
  if (!trainer.profile.premiumStudioEnabledAt) {
    return { error: "This coach is not on Premium, so token appreciation is not available for this thread." };
  }
  const weekKey = newYorkIsoWeekKey();
  const used = await getClientTrainerGiftSumThisWeek(clientId, trainer.id, weekKey);
  if (used + amount > MAX_CLIENT_GIFT_TO_TRAINER_PER_WEEK) {
    return {
      error: `You can send at most ${MAX_CLIENT_GIFT_TO_TRAINER_PER_WEEK} tokens per week to this coach. Already sent ${used}.`,
    };
  }
  const txCount = await prisma.trainerClientServiceTransaction.count({
    where: { clientId, trainerId: trainer.id },
  });
  if (txCount < 1) {
    return {
      error: "Tokens unlock after at least one recorded service purchase with this coach (platform checkout).",
    };
  }
  try {
    await prisma.$transaction(async (tx) => {
      const gift = await tx.clientTrainerTokenGift.create({
        data: { clientId, trainerId: trainer.id, amount, weekKey },
      });
      await applyTrainerTokenDelta(
        tx,
        trainer.id,
        amount,
        "CLIENT_GIFT",
        `gift:${gift.id}`,
        JSON.stringify({ clientId }),
      );
      if (announceConversationId) {
        await tx.trainerClientChatMessage.create({
          data: {
            conversationId: announceConversationId,
            authorRole: "CLIENT",
            body: `[Match Fit] You sent ${amount} appreciation token(s) to your coach.`,
          },
        });
        await tx.trainerClientConversation.update({
          where: { id: announceConversationId },
          data: { updatedAt: new Date() },
        });
      }
    });
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { error: "Could not send tokens." };
  }
}

export async function buildClientChatTokenTipContext(
  clientId: string,
  trainerId: string,
): Promise<{
  trainerPremium: boolean;
  suggestedGift: number;
  giftedThisWeek: number;
  capPerWeek: number;
  hasQualifyingService: boolean;
}> {
  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { profile: { select: { premiumStudioEnabledAt: true } } },
  });
  const trainerPremium = Boolean(trainer?.profile?.premiumStudioEnabledAt);
  const weekKey = newYorkIsoWeekKey();
  const giftedThisWeek = trainerPremium
    ? await getClientTrainerGiftSumThisWeek(clientId, trainerId, weekKey)
    : 0;
  const hasQualifyingService =
    (await prisma.trainerClientServiceTransaction.count({
      where: { clientId, trainerId },
    })) > 0;
  return {
    trainerPremium,
    suggestedGift: SUGGESTED_CLIENT_GIFT_AMOUNT,
    giftedThisWeek,
    capPerWeek: MAX_CLIENT_GIFT_TO_TRAINER_PER_WEEK,
    hasQualifyingService,
  };
}

export function clientRecordForRegionalBoost(zipCode: string | null | undefined): string | null {
  return clientZipToPrefix(zipCode ?? null);
}

export async function recordTrainerServiceTransactionAndReward(args: {
  clientId: string;
  trainerId: string;
  amountCents: number;
  stripeCheckoutSessionId?: string | null;
  idempotencyKey?: string | null;
  source: "STRIPE_CHECKOUT" | "STAFF_IMPORT";
}): Promise<{ ok: true; transactionId: string; duplicate?: boolean } | { error: string }> {
  if (args.stripeCheckoutSessionId) {
    const existing = await prisma.trainerClientServiceTransaction.findUnique({
      where: { stripeCheckoutSessionId: args.stripeCheckoutSessionId },
      select: { id: true },
    });
    if (existing) {
      await grantSaleTokensForServiceTransaction(existing.id);
      return { ok: true, transactionId: existing.id, duplicate: true };
    }
  }
  if (args.idempotencyKey) {
    const existing = await prisma.trainerClientServiceTransaction.findFirst({
      where: { idempotencyKey: args.idempotencyKey },
      select: { id: true },
    });
    if (existing) {
      await grantSaleTokensForServiceTransaction(existing.id);
      return { ok: true, transactionId: existing.id, duplicate: true };
    }
  }
  try {
    const row = await prisma.trainerClientServiceTransaction.create({
      data: {
        clientId: args.clientId,
        trainerId: args.trainerId,
        completedAt: new Date(),
        amountCents: args.amountCents,
        source: args.source,
        stripeCheckoutSessionId: args.stripeCheckoutSessionId ?? undefined,
        idempotencyKey: args.idempotencyKey ?? undefined,
      },
    });
    await grantSaleTokensForServiceTransaction(row.id);
    return { ok: true, transactionId: row.id };
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "P2002") {
      if (args.idempotencyKey) {
        const row = await prisma.trainerClientServiceTransaction.findFirst({
          where: { idempotencyKey: args.idempotencyKey },
          select: { id: true },
        });
        if (row) {
          await grantSaleTokensForServiceTransaction(row.id);
          return { ok: true, transactionId: row.id, duplicate: true };
        }
      }
      if (args.stripeCheckoutSessionId) {
        const row = await prisma.trainerClientServiceTransaction.findUnique({
          where: { stripeCheckoutSessionId: args.stripeCheckoutSessionId },
          select: { id: true },
        });
        if (row) {
          await grantSaleTokensForServiceTransaction(row.id);
          return { ok: true, transactionId: row.id, duplicate: true };
        }
      }
      return { error: "duplicate" };
    }
    throw e;
  }
}

export type TrainerPromotionDashboardRow = {
  id: string;
  phase: "scheduled" | "current" | "past";
  startsAt: string;
  endsAt: string;
  tokensSpent: number;
  durationDays: number;
  regionZipPrefix: string;
  tokensPerDay: number;
  /** Same formula as client FitHub feed when viewer ZIP matches promotion region (0–160 scale). */
  estMaxRegionalBoost: number;
  post: { id: string; caption: string | null; mediaUrl: string | null; postType: string };
  stats: { likes: number; comments: number; reposts: number; shares: number };
  statsWindowNote: string;
};

export async function listTrainerPromotionsForDashboard(trainerId: string): Promise<TrainerPromotionDashboardRow[]> {
  const now = new Date();
  const rows = await prisma.trainerFitHubPostPromotion.findMany({
    where: { trainerId },
    orderBy: { startsAt: "desc" },
    take: 100,
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      tokensSpent: true,
      durationDays: true,
      regionZipPrefix: true,
      post: { select: { id: true, caption: true, mediaUrl: true, postType: true } },
    },
  });

  const out: TrainerPromotionDashboardRow[] = [];
  for (const r of rows) {
    const phase = promotionPhase(r.startsAt, r.endsAt, now);
    let rangeStart = r.startsAt;
    let rangeEnd = r.endsAt;
    let statsWindowNote: string;
    if (phase === "scheduled") {
      rangeEnd = r.startsAt;
      statsWindowNote = "Engagement counts appear after the promotion starts.";
    } else if (phase === "current") {
      rangeEnd = now < r.endsAt ? now : r.endsAt;
      statsWindowNote = "Engagement so far during this active window (updates as the run continues).";
    } else {
      statsWindowNote = "Total engagement recorded during the completed promotion window.";
    }
    const stats =
      phase === "scheduled"
        ? { likes: 0, comments: 0, reposts: 0, shares: 0 }
        : await getPostEngagementBetween(r.post.id, rangeStart, rangeEnd);
    const tokensPerDay = r.tokensSpent / Math.max(1, r.durationDays);
    const estMaxRegionalBoost = promotionRegionalFeedBoost(
      r.tokensSpent,
      r.durationDays,
      r.regionZipPrefix,
      r.regionZipPrefix,
    );
    out.push({
      id: r.id,
      phase,
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt.toISOString(),
      tokensSpent: r.tokensSpent,
      durationDays: r.durationDays,
      regionZipPrefix: r.regionZipPrefix,
      tokensPerDay: Math.round(tokensPerDay * 100) / 100,
      estMaxRegionalBoost,
      post: {
        id: r.post.id,
        caption: r.post.caption,
        mediaUrl: r.post.mediaUrl,
        postType: r.post.postType,
      },
      stats,
      statsWindowNote,
    });
  }
  return out;
}
