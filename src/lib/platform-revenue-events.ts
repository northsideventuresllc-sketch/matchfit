import { Prisma } from "@/generated/prisma/client";
import { isMissingAdminReportingTableError } from "@/lib/ensure-admin-reporting-schema";
import {
  countLaunchPlatformSubscribers,
  countLaunchPremiumTrainers,
  launchClientCountWhere,
  launchTrainerCountWhere,
} from "@/lib/launch-account-counts";
import { prisma } from "@/lib/prisma";
import {
  LIVE_PLATFORM_REVENUE_WHERE,
  scrubNonLivePlatformRevenueEvents,
} from "@/lib/platform-revenue-filters";
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
  return isMissingAdminReportingTableError(e);
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
  billingLiveMode?: boolean;
}): Promise<void> {
  const revenueCents = Math.max(0, Math.floor(args.revenueCents));
  const grossProfitCents = Math.max(0, Math.floor(args.grossProfitCents));
  if (args.billingLiveMode === false) return;
  try {
    await prisma.platformRevenueEvent.create({
      data: {
        category: args.category,
        idempotencyKey: args.idempotencyKey,
        revenueCents,
        grossProfitCents,
        clientId: args.clientId ?? undefined,
        trainerId: args.trainerId ?? undefined,
        billingLiveMode: true,
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
  billingLiveMode?: boolean;
}): Promise<void> {
  let billingLiveMode = args.billingLiveMode;
  if (billingLiveMode === undefined) {
    const client = await prisma.client.findUnique({
      where: { id: args.clientId },
      select: { stripeBillingLiveMode: true },
    });
    billingLiveMode = client?.stripeBillingLiveMode !== false;
  }

  const breakdown = serviceCheckoutRevenueProfit(args);
  await recordPlatformRevenueEvent({
    category: "SERVICE_CHECKOUT",
    idempotencyKey: `service_tx:${args.transactionId}`,
    revenueCents: breakdown.revenueCents,
    grossProfitCents: breakdown.grossProfitCents,
    clientId: args.clientId,
    trainerId: args.trainerId,
    occurredAt: args.completedAt,
    billingLiveMode,
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
  billingLiveMode?: boolean;
}): Promise<void> {
  let billingLiveMode = args.billingLiveMode;
  if (billingLiveMode === undefined && args.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: args.clientId },
      select: { stripeBillingLiveMode: true },
    });
    billingLiveMode = client?.stripeBillingLiveMode !== false;
  }

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
    billingLiveMode,
  });
}

export async function recordTrainerPremiumSubscriptionInvoiceEvent(args: {
  stripeInvoiceId: string;
  trainerId: string;
  platformProfitCents?: number;
  billingLiveMode?: boolean;
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
    billingLiveMode: args.billingLiveMode,
  });
}

function inferPromoPackUsdCents(tokenAmount: number): number | null {
  const tier = PROMO_TOKEN_PACK_TIERS.find((t) => t.tokens === tokenAmount);
  return tier?.usdCents ?? null;
}

async function backfillPlatformRevenueEvents(): Promise<void> {
  const launchClients = await prisma.client.findMany({
    where: launchClientCountWhere(),
    select: { id: true },
    take: 5000,
  });
  const launchClientIds = new Set(launchClients.map((c) => c.id));

  const launchTrainers = await prisma.trainer.findMany({
    where: launchTrainerCountWhere(),
    select: { id: true },
    take: 5000,
  });
  const launchTrainerIds = new Set(launchTrainers.map((t) => t.id));

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
    if (!launchClientIds.has(row.clientId) || !launchTrainerIds.has(row.trainerId)) continue;
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
    where: {
      hasPaidRegistrationFee: true,
      registrationFeePaidCents: { gt: 0 },
      trainer: launchTrainerCountWhere(),
    },
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
    where: {
      reason: "STRIPE_PURCHASE",
      referenceKey: { not: null },
      trainer: launchTrainerCountWhere(),
    },
    select: { trainerId: true, delta: true, referenceKey: true, createdAt: true },
    take: 5000,
    orderBy: { createdAt: "asc" },
  });
  const payingClients = await prisma.client.findMany({
    where: {
      ...launchClientCountWhere(),
      stripeBillingLiveMode: true,
      stripeLastSubscriptionInvoicePaidAt: { not: null },
    },
    select: { id: true, stripeLastSubscriptionInvoicePaidAt: true },
    take: 5000,
  });
  for (const c of payingClients) {
    if (!c.stripeLastSubscriptionInvoicePaidAt) continue;
    await recordClientSubscriptionInvoiceEvent({
      stripeInvoiceId: `backfill:${c.id}`,
      clientId: c.id,
      occurredAt: c.stripeLastSubscriptionInvoicePaidAt,
      billingLiveMode: true,
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
  await scrubNonLivePlatformRevenueEvents();

  const [activeClientSubscribers, activeTrainerPremiumSubscribers] = await Promise.all([
    countLaunchPlatformSubscribers(),
    countLaunchPremiumTrainers(),
  ]);

  try {
    const grouped = await prisma.platformRevenueEvent.groupBy({
      by: ["category"],
      where: LIVE_PLATFORM_REVENUE_WHERE,
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
