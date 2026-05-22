import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { betaExcludeCapCountEmails } from "@/lib/beta-launch-config";

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

function buildEmailExcludeClause(emails: string[]): Prisma.Sql {
  if (emails.length === 0) return Prisma.empty;
  return Prisma.sql`AND LOWER(t."email") NOT IN (${Prisma.join(emails.map((e) => Prisma.sql`${e}`))})`;
}

function buildClientEmailExcludeClause(emails: string[]): Prisma.Sql {
  if (emails.length === 0) return Prisma.empty;
  return Prisma.sql`AND LOWER(c."email") NOT IN (${Prisma.join(emails.map((e) => Prisma.sql`${e}`))})`;
}

async function queryHomeUserCounts(
  excludeInternalQaSynthetic: boolean,
  excludeEmails: string[],
): Promise<HomeUserCounts> {
  const trainerSynthClause = excludeInternalQaSynthetic
    ? Prisma.sql`AND t."internalQaSyntheticPersona" = false`
    : Prisma.empty;
  const clientSynthClause = excludeInternalQaSynthetic
    ? Prisma.sql`AND c."internalQaSyntheticPersona" = false`
    : Prisma.empty;
  const trainerEmailClause = buildEmailExcludeClause(excludeEmails);
  const clientEmailClause = buildClientEmailExcludeClause(excludeEmails);

  const rows = await prisma.$queryRaw<CountRow[]>`
    SELECT
      (
        SELECT COUNT(*)::bigint
        FROM "trainers" t
        WHERE t."deidentifiedAt" IS NULL
          ${trainerSynthClause}
          ${trainerEmailClause}
      ) AS trainers_total,
      (
        SELECT COUNT(*)::bigint
        FROM "trainers" t
        INNER JOIN "trainer_profiles" p ON p."trainerId" = t."id"
        WHERE t."deidentifiedAt" IS NULL
          ${trainerSynthClause}
          ${trainerEmailClause}
          AND p."dashboardActivatedAt" IS NOT NULL
          AND (
            p."dashboardActivatedAt" >= NOW() - INTERVAL '60 days'
            OR EXISTS (
              SELECT 1
              FROM "trainer_client_chat_messages" m
              INNER JOIN "trainer_client_conversations" c ON c."id" = m."conversationId"
              WHERE c."trainerId" = t."id"
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
          ${clientSynthClause}
          ${clientEmailClause}
      ) AS clients_total,
      (
        SELECT COUNT(*)::bigint
        FROM "clients" c
        WHERE c."deidentifiedAt" IS NULL
          ${clientSynthClause}
          ${clientEmailClause}
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
 * Homepage marketing counters. Trainers "active": dashboard onboarding completed and either
 * activated in the last 60 days or platform activity (messages, sessions, FitHub, punch-ins) in the last 7 days.
 * Clients "active": billing in good standing (no platform sub, active sub, or grace window) or a subscription
 * invoice paid in the last 14 days (`stripeLastSubscriptionInvoicePaidAt`, maintained by Stripe webhooks).
 *
 * Excludes internal QA synthetic personas and any emails listed in MATCH_FIT_BETA_EXCLUDE_CAP_COUNT_EMAILS.
 * If migration `20260515182000_internal_qa_sandbox` is not applied yet, retries without filtering on
 * `internalQaSyntheticPersona` (equivalent to "no synthetic rows" on an unmigrated DB).
 */
export async function getHomeUserCounts(): Promise<HomeUserCounts> {
  const excludeEmails = [...betaExcludeCapCountEmails()].map((e) => e.toLowerCase());
  try {
    return await queryHomeUserCounts(true, excludeEmails);
  } catch (e) {
    if (isMissingInternalQaSyntheticPersonaColumn(e)) {
      return queryHomeUserCounts(false, excludeEmails);
    }
    throw e;
  }
}
