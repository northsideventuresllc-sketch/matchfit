import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type {
  AdminFitProPipelineCheckpoint,
  AdminFitProPipelineTierPanel,
  AdminTrainerPipelineEntry,
} from "@/lib/admin-portal-types";
import {
  ADMIN_FITPRO_TIER_CATEGORIES,
  adminFitProPipelineCheckpointsForCategory,
  type AdminFitProPipelineCheckpointId,
  type AdminFitProTierCategoryId,
} from "@/lib/admin-fitpro-tier-categories";
import type { FpAccountTier } from "@/lib/fp-account-tier-types";
import { adminPendingTrainerWhere, buildAdminPortalTrainerSqlFilter } from "@/lib/admin-portal-list-filters";
import { filterOwnerTestIdentities } from "@/lib/owner-test-account-exclusion";
import { prisma } from "@/lib/prisma";
import { buildTrainerPendingQualifications } from "@/lib/trainer-membership-status";
import { launchTrainerCountWhere } from "@/lib/launch-account-counts";

const BG_FAILED_STATUSES = ["DENIED", "NEEDS_FURTHER_REVIEW", "REJECTED", "CONSIDER", "PENDING_REVIEW"];

type CountRow = { n: bigint };

function n(row: CountRow | undefined): number {
  return row ? Number(row.n) : 0;
}

function pct(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
}

function tierSqlIn(tiers: FpAccountTier[]): Prisma.Sql {
  return Prisma.join(tiers.map((tier) => Prisma.sql`${tier}`));
}

function pendingTrainerWhereForTiers(tiers: FpAccountTier[]) {
  return {
    AND: [adminPendingTrainerWhere(), { profile: { is: { accountTier: { in: tiers } } } }],
  };
}

async function countCheckpoint(
  checkpointId: AdminFitProPipelineCheckpointId,
  tiers: FpAccountTier[],
  trainerMetricsFilter: Prisma.Sql,
  now: Date,
): Promise<number> {
  const baseWhere = Prisma.sql`t."deidentifiedAt" IS NULL ${trainerMetricsFilter} AND p."accountTier" IN (${tierSqlIn(tiers)})`;

  switch (checkpointId) {
    case "pending_onboarding":
      return prisma.trainer.count({ where: pendingTrainerWhereForTiers(tiers) });
    case "onboarding_fee_incomplete": {
      const rows = await prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS n FROM trainers t
        INNER JOIN trainer_profiles p ON p."trainerId" = t.id
        WHERE ${baseWhere}
          AND COALESCE(p."hasPaidRegistrationFee", false) = false
          AND COALESCE(p."registrationFeeHoldStatus", '') NOT IN ('HELD', 'CAPTURED')
      `;
      return n(rows[0]);
    }
    case "onboarding_fee_complete": {
      const rows = await prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS n FROM trainers t
        INNER JOIN trainer_profiles p ON p."trainerId" = t.id
        WHERE ${baseWhere}
          AND (
            COALESCE(p."hasPaidRegistrationFee", false) = true
            OR p."registrationFeeHoldStatus" = 'CAPTURED'
          )
      `;
      return n(rows[0]);
    }
    case "bg_submitted": {
      const rows = await prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS n FROM trainers t
        INNER JOIN trainer_profiles p ON p."trainerId" = t.id
        WHERE ${baseWhere}
          AND (
            p."checkrReportId" IS NOT NULL
            OR (
              p."backgroundCheckStatus" IS NOT NULL
              AND p."backgroundCheckStatus" <> 'NOT_STARTED'
              AND p."backgroundCheckStatus" <> 'APPROVED'
            )
          )
      `;
      return n(rows[0]);
    }
    case "bg_review": {
      const rows = await prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS n FROM trainers t
        INNER JOIN trainer_profiles p ON p."trainerId" = t.id
        WHERE ${baseWhere}
          AND (
            p."backgroundCheckStatus" IN (${Prisma.join(BG_FAILED_STATUSES.map((s) => Prisma.sql`${s}`))})
            OR p."backgroundCheckReviewStatus" IN (${Prisma.join(BG_FAILED_STATUSES.map((s) => Prisma.sql`${s}`))})
          )
      `;
      return n(rows[0]);
    }
    case "bg_passed": {
      const rows = await prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS n FROM trainers t
        INNER JOIN trainer_profiles p ON p."trainerId" = t.id
        WHERE ${baseWhere}
          AND (
            p."backgroundCheckStatus" = 'APPROVED'
            OR p."backgroundCheckPassed" = true
          )
      `;
      return n(rows[0]);
    }
    case "fp_docs_pending": {
      const rows = await prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS n FROM trainers t
        INNER JOIN trainer_profiles p ON p."trainerId" = t.id
        WHERE ${baseWhere}
          AND (
            (p."docsSubmitted" = true AND COALESCE(p."docsApproved", false) = false)
            OR (
              (p."certificationUrl" IS NOT NULL AND p."certificationReviewStatus" <> 'APPROVED')
              OR (p."nutritionistCertificationUrl" IS NOT NULL AND p."nutritionistCertificationReviewStatus" <> 'APPROVED')
              OR (p."specialistCertificationUrl" IS NOT NULL AND p."specialistCertificationReviewStatus" <> 'APPROVED')
              OR (p."otherCertificationUrl" IS NOT NULL AND p."otherCertificationReviewStatus" <> 'APPROVED')
            )
          )
      `;
      return n(rows[0]);
    }
    case "fp_docs_complete": {
      const rows = await prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS n FROM trainers t
        INNER JOIN trainer_profiles p ON p."trainerId" = t.id
        WHERE ${baseWhere}
          AND (
            p."docsApproved" = true
            OR (
              (p."certificationUrl" IS NULL OR p."certificationReviewStatus" = 'APPROVED')
              AND (p."nutritionistCertificationUrl" IS NULL OR p."nutritionistCertificationReviewStatus" = 'APPROVED')
              AND (p."specialistCertificationUrl" IS NULL OR p."specialistCertificationReviewStatus" = 'APPROVED')
              AND (p."otherCertificationUrl" IS NULL OR p."otherCertificationReviewStatus" = 'APPROVED')
              AND (
                p."certificationUrl" IS NOT NULL
                OR p."nutritionistCertificationUrl" IS NOT NULL
                OR p."specialistCertificationUrl" IS NOT NULL
                OR p."otherCertificationUrl" IS NOT NULL
                OR p."docsApproved" = true
              )
            )
          )
      `;
      return n(rows[0]);
    }
    case "monthly_subscription_pending": {
      const rows = await prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS n FROM trainers t
        INNER JOIN trainer_profiles p ON p."trainerId" = t.id
        WHERE ${baseWhere}
          AND p."dashboardActivatedAt" IS NULL
          AND (p."billingCycleEnd" IS NULL OR p."billingCycleEnd" <= ${now})
      `;
      return n(rows[0]);
    }
    case "monthly_subscription_active": {
      const rows = await prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS n FROM trainers t
        INNER JOIN trainer_profiles p ON p."trainerId" = t.id
        WHERE ${baseWhere}
          AND p."billingCycleEnd" IS NOT NULL
          AND p."billingCycleEnd" > ${now}
      `;
      return n(rows[0]);
    }
    case "premium_studio_enabled": {
      const rows = await prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS n FROM trainers t
        INNER JOIN trainer_profiles p ON p."trainerId" = t.id
        WHERE ${baseWhere}
          AND p."premiumStudioEnabledAt" IS NOT NULL
      `;
      return n(rows[0]);
    }
    case "live": {
      const rows = await prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS n FROM trainers t
        INNER JOIN trainer_profiles p ON p."trainerId" = t.id
        WHERE ${baseWhere}
          AND p."dashboardActivatedAt" IS NOT NULL
      `;
      return n(rows[0]);
    }
    default:
      return 0;
  }
}

async function loadPendingTrainersForTiers(tiers: FpAccountTier[]): Promise<AdminTrainerPipelineEntry[]> {
  const pendingTrainerRows = await prisma.trainer.findMany({
    where: pendingTrainerWhereForTiers(tiers),
    orderBy: { updatedAt: "desc" },
    take: 40,
    select: {
      id: true,
      username: true,
      preferredName: true,
      firstName: true,
      lastName: true,
      termsAcceptedAt: true,
      deidentifiedAt: true,
      profile: {
        select: {
          accountTier: true,
          hasSignedTOS: true,
          complianceWindowStartedAt: true,
          hasPaidRegistrationFee: true,
          registrationFeeHoldStatus: true,
          backgroundCheckStatus: true,
          backgroundCheckReviewStatus: true,
          certificationReviewStatus: true,
          nutritionistCertificationReviewStatus: true,
          specialistCertificationReviewStatus: true,
          otherCertificationReviewStatus: true,
          certificationUrl: true,
          nutritionistCertificationUrl: true,
          specialistCertificationUrl: true,
          otherCertificationUrl: true,
        },
      },
    },
  });

  return filterOwnerTestIdentities(pendingTrainerRows, (t) => ({ username: t.username, role: "trainer" })).map(
    (t) => {
      const qualifications = buildTrainerPendingQualifications({
        termsAcceptedAt: t.termsAcceptedAt,
        profile: t.profile,
      });
      return {
        trainerId: t.id,
        username: t.username,
        displayName:
          t.preferredName?.trim() || [t.firstName, t.lastName].filter(Boolean).join(" ").trim() || t.username,
        accountTier: t.profile?.accountTier ?? null,
        deidentified: Boolean(t.deidentifiedAt),
        ...qualifications,
      };
    },
  );
}

export async function buildAdminFitProPipelineTierPanels(now = new Date()): Promise<AdminFitProPipelineTierPanel[]> {
  const trainerMetricsFilter = buildAdminPortalTrainerSqlFilter();

  return Promise.all(
    ADMIN_FITPRO_TIER_CATEGORIES.map(async (category) => {
      const tiers = [...category.tiers];
      const checkpointDefs = adminFitProPipelineCheckpointsForCategory(category.id);
      const counts = await Promise.all(
        checkpointDefs.map((def) => countCheckpoint(def.id, tiers, trainerMetricsFilter, now)),
      );
      const totalInPipeline = counts[0] ?? 0;
      const checkpoints: AdminFitProPipelineCheckpoint[] = checkpointDefs.map((def, index) => ({
        id: def.id,
        label: def.label,
        count: counts[index] ?? 0,
        percentOfCategory: pct(counts[index] ?? 0, totalInPipeline),
      }));
      const pendingTrainers = await loadPendingTrainersForTiers(tiers);

      return {
        categoryId: category.id,
        label: category.label,
        totalInPipeline,
        checkpoints,
        pendingTrainers,
      };
    }),
  );
}

export async function countActiveFitProsForTiers(tiers: FpAccountTier[]): Promise<number> {
  return prisma.trainer.count({
    where: {
      ...launchTrainerCountWhere(),
      profile: {
        is: {
          accountTier: { in: tiers },
          dashboardActivatedAt: { not: null },
        },
      },
    },
  });
}

export async function countPendingFitProsForTiers(tiers: FpAccountTier[]): Promise<number> {
  return prisma.trainer.count({ where: pendingTrainerWhereForTiers(tiers) });
}

export async function countPremiumStudioForTiers(tiers: FpAccountTier[]): Promise<number> {
  return prisma.trainerProfile.count({
    where: {
      accountTier: { in: tiers },
      premiumStudioEnabledAt: { not: null },
      trainer: launchTrainerCountWhere(),
    },
  });
}

export function trainerTierCategoryWhere(categoryId: AdminFitProTierCategoryId) {
  const category = ADMIN_FITPRO_TIER_CATEGORIES.find((c) => c.id === categoryId);
  if (!category) return { accountTier: { in: [] as string[] } };
  return { accountTier: { in: [...category.tiers] } };
}
