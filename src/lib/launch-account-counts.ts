import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { betaExcludeCapCountEmails, betaExcludeCapCountUsernames } from "@/lib/beta-launch-config";
import {
  getMatchFitInternalQaClientEmails,
  getMatchFitInternalQaTrainerEmails,
} from "@/lib/match-fit-internal-qa";

/** Auto-generated internal QA personas (see `internal-qa-simulation.ts`). */
export const INTERNAL_SYNTHETIC_EMAIL_SUFFIX = "@internal.match-fit.invalid";

export function isInternalSyntheticMatchFitEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(INTERNAL_SYNTHETIC_EMAIL_SUFFIX);
}

/** Owner dev/test accounts from `scripts/seed-match-fit-dev-test-accounts.js`. */
const BUILTIN_EXCLUDE_CLIENT_USERNAMES = ["jbfitness6299"] as const;
const BUILTIN_EXCLUDE_CLIENT_EMAILS = ["jonnybooth22@gmail.com"] as const;
const BUILTIN_EXCLUDE_TRAINER_USERNAMES = ["coachjonny22"] as const;
const BUILTIN_EXCLUDE_TRAINER_EMAILS = ["jb@northsideventuresgroup.com"] as const;

export function getLaunchExcludeEmails(role: "client" | "trainer"): string[] {
  const ex = new Set<string>([...betaExcludeCapCountEmails()].map((e) => e.toLowerCase()));
  const builtin = role === "client" ? BUILTIN_EXCLUDE_CLIENT_EMAILS : BUILTIN_EXCLUDE_TRAINER_EMAILS;
  for (const e of builtin) ex.add(e.toLowerCase());
  const qa = role === "client" ? getMatchFitInternalQaClientEmails() : getMatchFitInternalQaTrainerEmails();
  for (const e of qa) ex.add(e.toLowerCase());
  return [...ex];
}

export function getLaunchExcludeUsernames(role: "client" | "trainer"): string[] {
  const ex = new Set<string>([...betaExcludeCapCountUsernames()].map((u) => u.toLowerCase()));
  const builtin = role === "client" ? BUILTIN_EXCLUDE_CLIENT_USERNAMES : BUILTIN_EXCLUDE_TRAINER_USERNAMES;
  for (const u of builtin) ex.add(u.toLowerCase());
  return [...ex];
}

function launchCountNotClause(role: "client" | "trainer") {
  const excludedEmails = getLaunchExcludeEmails(role);
  const excludedUsernames = getLaunchExcludeUsernames(role);
  const or = [
    { email: { endsWith: INTERNAL_SYNTHETIC_EMAIL_SUFFIX, mode: "insensitive" as const } },
    { email: { endsWith: ".invalid", mode: "insensitive" as const } },
    ...(excludedEmails.length > 0 ? [{ email: { in: excludedEmails } }] : []),
    ...(excludedUsernames.length > 0
      ? [{ username: { in: excludedUsernames, mode: "insensitive" as const } }]
      : []),
  ];
  return { OR: or };
}

export const SYNTHETIC_TRAINER_USERNAME_PREFIX = "mfqst_";
export const SYNTHETIC_CLIENT_USERNAME_PREFIX = "mfqsc_";

export function launchTrainerCountWhere(): Prisma.TrainerWhereInput {
  return {
    deidentifiedAt: null,
    internalQaSyntheticPersona: false,
    NOT: {
      OR: [
        ...launchCountNotClause("trainer").OR,
        { username: { startsWith: SYNTHETIC_TRAINER_USERNAME_PREFIX, mode: "insensitive" } },
      ],
    },
  };
}

export function launchClientCountWhere(): Prisma.ClientWhereInput {
  return {
    deidentifiedAt: null,
    internalQaSyntheticPersona: false,
    NOT: {
      OR: [
        ...launchCountNotClause("client").OR,
        { username: { startsWith: SYNTHETIC_CLIENT_USERNAME_PREFIX, mode: "insensitive" } },
      ],
    },
  };
}

/** Live platform subscribers (excludes test accounts and sandbox billing). */
export function launchPlatformSubscriberCountWhere(): Prisma.ClientWhereInput {
  return {
    ...launchClientCountWhere(),
    stripeSubscriptionActive: true,
    stripeSubscriptionId: { not: null },
    stripeBillingLiveMode: true,
  };
}

/** Premium trainer studio subscribers (excludes test accounts). */
export function launchPremiumTrainerCountWhere(): Prisma.TrainerProfileWhereInput {
  return {
    premiumStudioEnabledAt: { not: null },
    trainer: launchTrainerCountWhere(),
  };
}

export async function countLaunchClients(): Promise<number> {
  return prisma.client.count({ where: launchClientCountWhere() });
}

export async function countLaunchTrainers(): Promise<number> {
  return prisma.trainer.count({ where: launchTrainerCountWhere() });
}

export async function countLaunchPlatformSubscribers(): Promise<number> {
  return prisma.client.count({ where: launchPlatformSubscriberCountWhere() });
}

export async function countLaunchPremiumTrainers(): Promise<number> {
  return prisma.trainerProfile.count({ where: launchPremiumTrainerCountWhere() });
}

export async function countLaunchTrainersInTx(tx: Prisma.TransactionClient): Promise<number> {
  return tx.trainer.count({ where: launchTrainerCountWhere() });
}

export async function countLaunchClientsInTx(tx: Prisma.TransactionClient): Promise<number> {
  return tx.client.count({ where: launchClientCountWhere() });
}

export async function countPendingClientRegistrations(): Promise<number> {
  return prisma.pendingClientRegistration.count({
    where: {
      status: { in: ["PENDING_2FA", "AWAITING_PAYMENT"] },
      expiresAt: { gt: new Date() },
    },
  });
}

/** Exclude test client/trainer ids from revenue aggregation. */
export async function getLaunchExcludedAccountIds(): Promise<{ clientIds: Set<string>; trainerIds: Set<string> }> {
  const [clients, trainers] = await Promise.all([
    prisma.client.findMany({
      where: { NOT: launchClientCountWhere() },
      select: { id: true },
      take: 5000,
    }),
    prisma.trainer.findMany({
      where: { NOT: launchTrainerCountWhere() },
      select: { id: true },
      take: 5000,
    }),
  ]);
  return {
    clientIds: new Set(clients.map((c) => c.id)),
    trainerIds: new Set(trainers.map((t) => t.id)),
  };
}
