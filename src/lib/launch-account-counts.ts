import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { betaExcludeCapCountEmails, betaExcludeCapCountUsernames } from "@/lib/beta-launch-config";
import {
  getMatchFitDevPlaceholderCertPathPrefixes,
  getMatchFitLaunchExcludeClientUsernames,
  getMatchFitLaunchExcludeEmails,
  getMatchFitLaunchExcludeTrainerUsernames,
  MATCH_FIT_INTEGRATION_TEST_EMAIL_SUFFIX,
} from "@/lib/match-fit-launch-exclude-accounts";
import {
  getMatchFitInternalQaClientEmails,
  getMatchFitInternalQaTrainerEmails,
} from "@/lib/match-fit-internal-qa";

/** Auto-generated internal QA personas (see `internal-qa-simulation.ts`). */
export const INTERNAL_SYNTHETIC_EMAIL_SUFFIX = "@internal.match-fit.invalid";

export const SYNTHETIC_TRAINER_USERNAME_PREFIX = "mfqst_";
export const SYNTHETIC_CLIENT_USERNAME_PREFIX = "mfqsc_";

/** Owner dev/test accounts from `scripts/seed-match-fit-dev-test-accounts.js` (never public launch totals). */
const BUILTIN_LAUNCH_EXCLUDE_CLIENT_USERNAMES = ["jbfitness6299"] as const;
const BUILTIN_LAUNCH_EXCLUDE_CLIENT_EMAILS = ["jonnybooth22@gmail.com"] as const;
const BUILTIN_LAUNCH_EXCLUDE_TRAINER_USERNAMES = ["coachjonny22"] as const;
const BUILTIN_LAUNCH_EXCLUDE_TRAINER_EMAILS = ["jb@northsideventuresgroup.com"] as const;

const DEV_CERT_PREFIXES = getMatchFitDevPlaceholderCertPathPrefixes();

export function isInternalSyntheticMatchFitEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(INTERNAL_SYNTHETIC_EMAIL_SUFFIX);
}

/** Emails that must never count toward beta caps, founding promos, or public signup totals. */
export function getLaunchExcludeEmails(role?: "client" | "trainer"): string[] {
  const ex = new Set<string>([...betaExcludeCapCountEmails()].map((e) => e.toLowerCase()));
  for (const e of getMatchFitLaunchExcludeEmails()) ex.add(e.toLowerCase());
  if (role) {
    const builtin =
      role === "client" ? BUILTIN_LAUNCH_EXCLUDE_CLIENT_EMAILS : BUILTIN_LAUNCH_EXCLUDE_TRAINER_EMAILS;
    for (const e of builtin) ex.add(e.toLowerCase());
    const qa = role === "client" ? getMatchFitInternalQaClientEmails() : getMatchFitInternalQaTrainerEmails();
    for (const e of qa) ex.add(e.toLowerCase());
  }
  return [...ex];
}

/** Usernames that must never count toward beta caps, founding promos, or public signup totals. */
export function getLaunchExcludeUsernames(role: "client" | "trainer"): string[] {
  const ex = new Set<string>([...betaExcludeCapCountUsernames()].map((u) => u.toLowerCase()));
  const builtin =
    role === "client" ? BUILTIN_LAUNCH_EXCLUDE_CLIENT_USERNAMES : BUILTIN_LAUNCH_EXCLUDE_TRAINER_USERNAMES;
  for (const u of builtin) ex.add(u.toLowerCase());
  return [...ex];
}

function launchEmailExcludeOr() {
  const excludedEmails = getLaunchExcludeEmails();
  return [
    { email: { endsWith: INTERNAL_SYNTHETIC_EMAIL_SUFFIX, mode: "insensitive" as const } },
    // Exclude all RFC 6761 .invalid TLD emails (test/demo/seed accounts)
    { email: { endsWith: ".invalid", mode: "insensitive" as const } },
    { email: { endsWith: MATCH_FIT_INTEGRATION_TEST_EMAIL_SUFFIX, mode: "insensitive" as const } },
    ...(excludedEmails.length > 0 ? [{ email: { in: excludedEmails } }] : []),
  ];
}

function launchUsernameExcludeOr(prefixes: readonly string[]) {
  const normalized = prefixes.map((prefix) => prefix.toLowerCase());
  return [
    ...(normalized.length > 0 ? [{ username: { in: normalized, mode: "insensitive" as const } }] : []),
    ...normalized.map((prefix) => ({
      username: { startsWith: prefix, mode: "insensitive" as const },
    })),
  ];
}

function launchTrainerEmailExcludeOr(): NonNullable<Prisma.TrainerWhereInput["OR"]> {
  return launchEmailExcludeOr() as NonNullable<Prisma.TrainerWhereInput["OR"]>;
}

function launchClientEmailExcludeOr(): NonNullable<Prisma.ClientWhereInput["OR"]> {
  return launchEmailExcludeOr() as NonNullable<Prisma.ClientWhereInput["OR"]>;
}

function launchTrainerUsernameExcludeOr(
  prefixes: readonly string[],
): NonNullable<Prisma.TrainerWhereInput["OR"]> {
  return launchUsernameExcludeOr(prefixes) as NonNullable<Prisma.TrainerWhereInput["OR"]>;
}

function launchClientUsernameExcludeOr(
  prefixes: readonly string[],
): NonNullable<Prisma.ClientWhereInput["OR"]> {
  return launchUsernameExcludeOr(prefixes) as NonNullable<Prisma.ClientWhereInput["OR"]>;
}

function launchDevCertExcludeOr(): NonNullable<Prisma.TrainerWhereInput["OR"]> {
  return DEV_CERT_PREFIXES.flatMap((prefix) => [
    { profile: { is: { certificationUrl: { startsWith: prefix, mode: "insensitive" } } } },
    { profile: { is: { nutritionistCertificationUrl: { startsWith: prefix, mode: "insensitive" } } } },
    { profile: { is: { specialistCertificationUrl: { startsWith: prefix, mode: "insensitive" } } } },
  ]) as NonNullable<Prisma.TrainerWhereInput["OR"]>;
}

/** Prisma filter for real launch signups (trainers). */
export function launchTrainerCountWhere(): Prisma.TrainerWhereInput {
  const usernameExcludes = [SYNTHETIC_TRAINER_USERNAME_PREFIX, ...getMatchFitLaunchExcludeTrainerUsernames()];

  return {
    deidentifiedAt: null,
    internalQaSyntheticPersona: false,
    NOT: {
      OR: [
        ...launchTrainerEmailExcludeOr(),
        ...launchTrainerUsernameExcludeOr(usernameExcludes),
        ...launchDevCertExcludeOr(),
      ],
    },
  };
}

/** Prisma filter for real launch signups (clients). */
export function launchClientCountWhere(): Prisma.ClientWhereInput {
  const usernameExcludes = [SYNTHETIC_CLIENT_USERNAME_PREFIX, ...getMatchFitLaunchExcludeClientUsernames()];

  return {
    deidentifiedAt: null,
    internalQaSyntheticPersona: false,
    NOT: {
      OR: [...launchClientEmailExcludeOr(), ...launchClientUsernameExcludeOr(usernameExcludes)],
    },
  };
}

/**
 * Active platform subscribers for admin metrics: real (non-test) clients with a live Stripe
 * subscription (`stripeBillingLiveMode`), not sandbox/test billing.
 */
export function launchPlatformSubscriberCountWhere(): Prisma.ClientWhereInput {
  return {
    ...launchClientCountWhere(),
    stripeSubscriptionActive: true,
    stripeSubscriptionId: { not: null },
    stripeBillingLiveMode: true,
  };
}

export async function countLaunchPlatformSubscribers(): Promise<number> {
  return prisma.client.count({ where: launchPlatformSubscriberCountWhere() });
}

/** Active clients counted for beta cap and founding membership offers. */
export async function countLaunchClients(): Promise<number> {
  return prisma.client.count({ where: launchClientCountWhere() });
}

/** Active trainers counted for beta cap and founding registration pricing. */
export async function countLaunchTrainers(): Promise<number> {
  return prisma.trainer.count({ where: launchTrainerCountWhere() });
}

export async function countLaunchTrainersInTx(tx: Prisma.TransactionClient): Promise<number> {
  return tx.trainer.count({ where: launchTrainerCountWhere() });
}

export async function countLaunchClientsInTx(tx: Prisma.TransactionClient): Promise<number> {
  return tx.client.count({ where: launchClientCountWhere() });
}

/** Pending registrations awaiting payment (not yet active clients). */
export async function countPendingClientRegistrations(): Promise<number> {
  return prisma.pendingClientRegistration.count({
    where: {
      status: { in: ["PENDING_2FA", "AWAITING_PAYMENT"] },
      expiresAt: { gt: new Date() },
    },
  });
}
