import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CLIENT_PLATFORM_SUBSCRIPTION_PROFIT_CENTS,
  oneTimePurchaseRevenueProfit,
  oneTimePurchaseRevenueProfitFromTotalCharged,
  serviceCheckoutRevenueProfit,
  subscriptionRevenueProfit,
  TRAINER_PREMIUM_SUBSCRIPTION_PROFIT_CENTS,
  type PlatformRevenueCategory,
} from "@/lib/platform-revenue-accounting";
import { computeCheckoutFeeBreakdown } from "@/lib/stripe-checkout-line-items";
import { PROMO_TOKEN_PACK_TIERS, USD_PACK_PRICE_CENTS } from "@/lib/trainer-promo-tokens";

export type PlatformRevenueTotals = {
  revenueCents: number;
  grossProfitCents: number;
  eventCount: number;
  byCategory: Record<
    PlatformRevenueCategory,
    { revenueCents: number; grossProfitCents: number; eventCount: number }
  >;
  activeClientSubscribers: number;
  activeTrainerPremiumSubscribers: number;
};

const EMPTY_BY_CATEGORY = (): PlatformRevenueTotals["byCategory"] => ({
  SERVICE_CHECKOUT: { revenueCents: 0, grossProfitCents: 0, eventCount: 0 },
  CLIENT_PLATFORM_SUBSCRIPTION: { revenueCents: 0, grossProfitCents: 0, eventCount: 0 },
  TRAINER_PREMIUM_SUBSCRIPTION: { revenueCents: 0, grossProfitCents: 0, eventCount: 0 },
  ONE_TIME_PURCHASE: { revenueCents: 0, grossProfitCents: 0, eventCount: 0 },
});

function isMissingPlatformRevenueTable(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return e.code === "P2021" || (e.meta as { table?: string })?.table === "public.platform_revenue_events";
}

export async function recordPlatformRevenueEvent(args: {
  category: PlatformRevenueCategory;
  idempotencyKey: string;
  revenueCents: number;
  grossProfitCents: number;
  clientId?: string | null;
  trainerId?: string | null;
  metaJson?: string | null;
  occurredAt?: Date;
}): Promise<void> {
  const revenueCents = Math.max(0, Math.floor(args.revenueCents));
  const grossProfitCents = Math.max(0, Math.floor(args.grossProfitCents));
  try {
    await prisma.platformRevenueEvent.create({
      data: {
        category: args.category,
        idempotencyKey: args.idempotencyKey,
        revenueCents,
        grossProfitCents,
        clientId: args.clientId ?? undefined,
        trainerId: args.trainerId ?? undefined,
        metaJson: args.metaJson ?? undefined,
        ...(args.occurredAt ? { createdAt: args.occurredAt } : {}),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return;
    if (isMissingPlatformRevenueTable(e)) return;
    throw e;
  }
}

export async function recordServiceCheckoutRevenueEvent(args: {
  transactionId: string;
  clientId: string;
  trainerId: string;
  amountCents: number;
  totalChargedCents?: number | null;
  adminFeeCents?: number | null;
  ledgerGrossTotalCents?: number | null;
  completedAt?: Date;
}): Promise<void> {
  const breakdown = serviceCheckoutRevenueProfit(args);
  await recordPlatformRevenueEvent({
    category: "SERVICE_CHECKOUT",
    idempotencyKey: `service_tx:${args.transactionId}`,
    revenueCents: breakdown.revenueCents,
    grossProfitCents: breakdown.grossProfitCents,
    clientId: args.clientId,
    trainerId: args.trainerId,
    occurredAt: args.completedAt,
    metaJson: JSON.stringify({
      amountCents: args.amountCents,
      totalChargedCents: args.totalChargedCents ?? null,
      adminFeeCents: args.adminFeeCents ?? null,
    }),
  });
}

export async function recordClientSubscriptionInvoiceEvent(args: {
  stripeInvoiceId: string;
  clientId: string;
  platformProfitCents?: number;
  occurredAt?: Date;
}): Promise<void> {
  const breakdown = subscriptionRevenueProfit(
    args.platformProfitCents ?? CLIENT_PLATFORM_SUBSCRIPTION_PROFIT_CENTS,
  );
  await recordPlatformRevenueEvent({
    category: "CLIENT_PLATFORM_SUBSCRIPTION",
    idempotencyKey: `client_sub_invoice:${args.stripeInvoiceId}`,
    revenueCents: breakdown.revenueCents,
    grossProfitCents: breakdown.grossProfitCents,
    clientId: args.clientId,
    occurredAt: args.occurredAt,
  });
}

export async function recordTrainerPremiumSubscriptionInvoiceEvent(args: {
  stripeInvoiceId: string;
  trainerId: string;
  platformProfitCents?: number;
}): Promise<void> {
  const breakdown = subscriptionRevenueProfit(
    args.platformProfitCents ?? TRAINER_PREMIUM_SUBSCRIPTION_PROFIT_CENTS,
  );
  await recordPlatformRevenueEvent({
    category: "TRAINER_PREMIUM_SUBSCRIPTION",
    idempotencyKey: `trainer_premium_invoice:${args.stripeInvoiceId}`,
    revenueCents: breakdown.revenueCents,
    grossProfitCents: breakdown.grossProfitCents,
    trainerId: args.trainerId,
  });
}

function inferPromoPackUsdCents(tokenAmount: number): number | null {
  const tier = PROMO_TOKEN_PACK_TIERS.find((t) => t.tokens === tokenAmount);
  return tier?.usdCents ?? null;
}

async function backfillPlatformRevenueEvents(): Promise<void> {
  const serviceRows = await prisma.trainerClientServiceTransaction.findMany({
    select: {
      id: true,
      clientId: true,
      trainerId: true,
      amountCents: true,
      totalChargedCents: true,
      adminFeeCents: true,
      ledgerGrossTotalCents: true,
      completedAt: true,
    },
    take: 5000,
    orderBy: { completedAt: "asc" },
  });
  for (const row of serviceRows) {
    await recordServiceCheckoutRevenueEvent({
      transactionId: row.id,
      clientId: row.clientId,
      trainerId: row.trainerId,
      amountCents: row.amountCents,
      totalChargedCents: row.totalChargedCents,
      adminFeeCents: row.adminFeeCents,
      ledgerGrossTotalCents: row.ledgerGrossTotalCents,
      completedAt: row.completedAt,
    });
  }

  const registrationProfiles = await prisma.trainerProfile.findMany({
    where: { hasPaidRegistrationFee: true, registrationFeePaidCents: { gt: 0 } },
    select: { trainerId: true, registrationFeePaidCents: true },
    take: 5000,
  });
  for (const p of registrationProfiles) {
    const paid = p.registrationFeePaidCents ?? 0;
    if (paid <= 0) continue;
    const breakdown = oneTimePurchaseRevenueProfitFromTotalCharged(paid);
    await recordPlatformRevenueEvent({
      category: "ONE_TIME_PURCHASE",
      idempotencyKey: `trainer_registration:${p.trainerId}`,
      revenueCents: breakdown.revenueCents,
      grossProfitCents: breakdown.grossProfitCents,
      trainerId: p.trainerId,
      metaJson: JSON.stringify({ purpose: "trainer_registration_fee" }),
    });
  }

  const tokenPurchases = await prisma.trainerTokenLedgerEntry.findMany({
    where: { reason: "STRIPE_PURCHASE", referenceKey: { not: null } },
    select: { trainerId: true, delta: true, referenceKey: true, createdAt: true },
    take: 5000,
    orderBy: { createdAt: "asc" },
  });
  const payingClients = await prisma.client.findMany({
    where: { stripeLastSubscriptionInvoicePaidAt: { not: null }, deidentifiedAt: null },
    select: { id: true, stripeLastSubscriptionInvoicePaidAt: true },
    take: 5000,
  });
  for (const c of payingClients) {
    if (!c.stripeLastSubscriptionInvoicePaidAt) continue;
    await recordClientSubscriptionInvoiceEvent({
      stripeInvoiceId: `backfill:${c.id}`,
      clientId: c.id,
      occurredAt: c.stripeLastSubscriptionInvoicePaidAt,
    });
  }

  for (const entry of tokenPurchases) {
    const ref = entry.referenceKey?.trim();
    if (!ref) continue;
    const baseCents = inferPromoPackUsdCents(entry.delta);
    const breakdown = baseCents
      ? oneTimePurchaseRevenueProfit(
          computeCheckoutFeeBreakdown({
            baseCents,
            includeAdminFee: true,
            includeProcessingFee: true,
          }),
        )
      : oneTimePurchaseRevenueProfitFromTotalCharged(USD_PACK_PRICE_CENTS);
    await recordPlatformRevenueEvent({
      category: "ONE_TIME_PURCHASE",
      idempotencyKey: `promo_tokens:${ref}`,
      revenueCents: breakdown.revenueCents,
      grossProfitCents: breakdown.grossProfitCents,
      trainerId: entry.trainerId,
      occurredAt: entry.createdAt,
      metaJson: JSON.stringify({ purpose: "trainer_promo_tokens", tokens: entry.delta }),
    });
  }
}

export async function ensurePlatformRevenueBackfill(): Promise<void> {
  try {
    const existing = await prisma.platformRevenueEvent.count();
    if (existing > 0) return;
    await backfillPlatformRevenueEvents();
  } catch (e) {
    if (isMissingPlatformRevenueTable(e)) return;
    throw e;
  }
}

export async function getPlatformRevenueTotals(): Promise<PlatformRevenueTotals> {
  await ensurePlatformRevenueBackfill();

  const [activeClientSubscribers, activeTrainerPremiumSubscribers] = await Promise.all([
    prisma.client.count({ where: { deidentifiedAt: null, stripeSubscriptionActive: true } }),
    prisma.trainerProfile.count({
      where: { premiumStudioEnabledAt: { not: null }, trainer: { deidentifiedAt: null } },
    }),
  ]);

  try {
    const grouped = await prisma.platformRevenueEvent.groupBy({
      by: ["category"],
      _sum: { revenueCents: true, grossProfitCents: true },
      _count: { _all: true },
    });

    const byCategory = EMPTY_BY_CATEGORY();
    let revenueCents = 0;
    let grossProfitCents = 0;
    let eventCount = 0;

    for (const row of grouped) {
      const cat = row.category as PlatformRevenueCategory;
      if (!(cat in byCategory)) continue;
      const rev = row._sum.revenueCents ?? 0;
      const profit = row._sum.grossProfitCents ?? 0;
      const count = row._count._all;
      byCategory[cat] = { revenueCents: rev, grossProfitCents: profit, eventCount: count };
      revenueCents += rev;
      grossProfitCents += profit;
      eventCount += count;
    }

    return {
      revenueCents,
      grossProfitCents,
      eventCount,
      byCategory,
      activeClientSubscribers,
      activeTrainerPremiumSubscribers,
    };
  } catch (e) {
    if (!isMissingPlatformRevenueTable(e)) throw e;
    return {
      revenueCents: 0,
      grossProfitCents: 0,
      eventCount: 0,
      byCategory: EMPTY_BY_CATEGORY(),
      activeClientSubscribers,
      activeTrainerPremiumSubscribers,
    };
  }
}
