import { Prisma } from "@prisma/client";
import {
  homeUserCountClientWhereSql,
  homeUserCountTrainerWhereSql,
} from "@/lib/home-user-count-exclusions";
import { prisma } from "@/lib/prisma";

export type HomeUserCounts = {
  trainersTotal: number;
  trainersActive: number;
  clientsTotal: number;
  clientsActive: number;
};

type CountRow = {
  trainers_total: bigint;
  trainers_active: bigint;
  clients_total: bigint;
  clients_active: bigint;
};

function isMissingInternalQaSyntheticPersonaColumn(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const m = e.message;
  return m.includes("internalQaSyntheticPersona") && (m.includes("42703") || m.includes("does not exist"));
}

async function queryHomeUserCounts(excludeInternalQaSynthetic: boolean): Promise<HomeUserCounts> {
  const trainerMember = homeUserCountTrainerWhereSql({ excludeInternalQaSynthetic });
  const clientMember = homeUserCountClientWhereSql({ excludeInternalQaSynthetic });

  const rows = await prisma.$queryRaw<CountRow[]>`
    SELECT
      (
        SELECT COUNT(*)::bigint
        FROM "trainers" t
        WHERE t."deidentifiedAt" IS NULL
          ${trainerMember}
      ) AS trainers_total,
      (
        SELECT COUNT(*)::bigint
        FROM "trainers" t
        INNER JOIN "trainer_profiles" p ON p."trainerId" = t."id"
        WHERE t."deidentifiedAt" IS NULL
          ${trainerMember}
          AND p."dashboardActivatedAt" IS NOT NULL
          AND (
            p."dashboardActivatedAt" >= NOW() - INTERVAL '60 days'
            OR EXISTS (
              SELECT 1
              FROM "trainer_client_chat_messages" m
              INNER JOIN "trainer_client_conversations" conv ON conv."id" = m."conversationId"
              WHERE conv."trainerId" = t."id"
                AND m."authorRole" = 'TRAINER'
                AND m."createdAt" >= NOW() - INTERVAL '7 days'
            )
            OR EXISTS (
              SELECT 1
              FROM "booked_training_sessions" b
              WHERE b."trainerId" = t."id"
                AND b."updatedAt" >= NOW() - INTERVAL '7 days'
            )
            OR EXISTS (
              SELECT 1
              FROM "trainer_fit_hub_posts" f
              WHERE f."trainerId" = t."id"
                AND f."createdAt" >= NOW() - INTERVAL '7 days'
            )
            OR EXISTS (
              SELECT 1
              FROM "session_trainer_punch_ins" s
              WHERE s."trainerId" = t."id"
                AND s."createdAt" >= NOW() - INTERVAL '7 days'
            )
          )
      ) AS trainers_active,
      (
        SELECT COUNT(*)::bigint
        FROM "clients" c
        WHERE c."deidentifiedAt" IS NULL
          ${clientMember}
      ) AS clients_total,
      (
        SELECT COUNT(*)::bigint
        FROM "clients" c
        WHERE c."deidentifiedAt" IS NULL
          ${clientMember}
          AND (
            c."stripeSubscriptionId" IS NULL
            OR TRIM(c."stripeSubscriptionId") = ''
            OR c."stripeSubscriptionActive" = true
            OR (c."subscriptionGraceUntil" IS NOT NULL AND c."subscriptionGraceUntil" >= NOW())
            OR (
              c."stripeLastSubscriptionInvoicePaidAt" IS NOT NULL
              AND c."stripeLastSubscriptionInvoicePaidAt" >= NOW() - INTERVAL '14 days'
            )
          )
      ) AS clients_active
  `;

  const row = rows[0];
  if (!row) {
    return { trainersTotal: 0, trainersActive: 0, clientsTotal: 0, clientsActive: 0 };
  }

  return {
    trainersTotal: Number(row.trainers_total),
    trainersActive: Number(row.trainers_active),
    clientsTotal: Number(row.clients_total),
    clientsActive: Number(row.clients_active),
  };
}

/**
 * Homepage marketing counters — real members only (excludes internal QA, demo seeds, and synthetic personas).
 */
export async function getHomeUserCounts(): Promise<HomeUserCounts> {
  try {
    return await queryHomeUserCounts(true);
  } catch (e) {
    if (isMissingInternalQaSyntheticPersonaColumn(e)) {
      return queryHomeUserCounts(false);
    }
    throw e;
  }
}
