import { NextResponse } from "next/server";
import {
  FP_TIER_DISPLAY_NAMES,
  isFpAccountTier,
  type FpAccountTier,
} from "@/lib/fp-account-tier-types";
import { fpRequiredDocsForTier } from "@/lib/fp-tier-docs";
import {
  fpTierSwitchLockActive,
  fpTierSwitchLockEndsAt,
  type FpTierProfileFields,
} from "@/lib/fp-tier-switching";
import { getFpTierPermissions } from "@/lib/fp-tier-permissions";
import { fpTierBadgeLabel } from "@/lib/fp-discovery-trust";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";

export const dynamic = "force-dynamic";

const profileSelect = {
  accountTier: true,
  tierSwitchedAt: true,
  tierSwitchCount: true,
  pendingTier: true,
  listingStatus: true,
  billingCycleEnd: true,
  gracePeriodEnd: true,
  docsSubmitted: true,
  docsApproved: true,
  docsRejectionCount: true,
  docsLastRejectedAt: true,
  backgroundCheckPassed: true,
  promoteTokensBalance: true,
  promoteTokensResetAt: true,
} as const;

export async function GET() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      externalWebsiteUrl: true,
      eliteDashboardViewMode: true,
      stripeSubscriptionActive: true,
      profile: { select: profileSelect },
      fpListingStats: true,
      tierSwitchHistory: {
        orderBy: { switchedAt: "desc" },
        take: 20,
        select: {
          id: true,
          fromTier: true,
          toTier: true,
          switchedAt: true,
          initiatedBy: true,
        },
      },
      fpPromoteTokenLedger: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { id: true, action: true, amount: true, createdAt: true, referenceId: true },
      },
    },
  });

  if (!trainer?.profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const prof = trainer.profile as FpTierProfileFields;
  const tier = isFpAccountTier(prof.accountTier) ? prof.accountTier : null;
  const perms = tier ? getFpTierPermissions(tier) : null;

  return NextResponse.json({
    accountTier: tier,
    accountTierLabel: tier ? FP_TIER_DISPLAY_NAMES[tier] : null,
    badge: fpTierBadgeLabel(prof.accountTier),
    permissions: perms,
    listingStatus: prof.listingStatus,
    pendingTier: prof.pendingTier,
    tierSwitchLockActive: fpTierSwitchLockActive(prof),
    tierSwitchLockEndsAt: fpTierSwitchLockEndsAt(prof)?.toISOString() ?? null,
    tierSwitchCount: prof.tierSwitchCount,
    promoteTokensBalance: prof.promoteTokensBalance,
    externalWebsiteUrl: trainer.externalWebsiteUrl,
    eliteDashboardViewMode: trainer.eliteDashboardViewMode,
    stripeSubscriptionActive: trainer.stripeSubscriptionActive,
    requiredDocs: tier ? fpRequiredDocsForTier(tier) : [],
    listingStats: trainer.fpListingStats,
    tierSwitchHistory: trainer.tierSwitchHistory.map((row) => ({
      ...row,
      fromTierLabel: row.fromTier && isFpAccountTier(row.fromTier) ? FP_TIER_DISPLAY_NAMES[row.fromTier] : null,
      toTierLabel: isFpAccountTier(row.toTier) ? FP_TIER_DISPLAY_NAMES[row.toTier as FpAccountTier] : row.toTier,
      switchedAt: row.switchedAt.toISOString(),
    })),
    promoteTokenLedger: trainer.fpPromoteTokenLedger.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}
