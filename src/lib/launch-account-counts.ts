import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { betaExcludeCapCountEmails, betaExcludeCapCountUsernames } from "@/lib/beta-launch-config";
import {
  getMatchFitDevPlaceholderCertPathPrefixes,
  getMatchFitLaunchExcludeClientUsernames,
  getMatchFitLaunchExcludeEmails,
  getMatchFitLaunchExcludeTrainerUsernames,
} from "@/lib/match-fit-launch-exclude-accounts";
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

/** Emails that must never count toward beta caps, founding promos, or public signup totals. */
export function getLaunchExcludeEmails(role?: "client" | "trainer"): string[] {
  const ex = new Set<string>([...betaExcludeCapCountEmails()].map((e) => e.toLowerCase()));
  for (const e of getMatchFitLaunchExcludeEmails()) ex.add(e.toLowerCase());

  if (role === "client") {
    for (const e of BUILTIN_LAUNCH_EXCLUDE_CLIENT_EMAILS) ex.add(e.toLowerCase());
    for (const e of getMatchFitInternalQaClientEmails()) ex.add(e.toLowerCase());
  } else if (role === "trainer") {
    for (const e of BUILTIN_LAUNCH_EXCLUDE_TRAINER_EMAILS) ex.add(e.toLowerCase());
    for (const e of getMatchFitInternalQaTrainerEmails()) ex.add(e.toLowerCase());
  } else {
    for (const e of BUILTIN_LAUNCH_EXCLUDE_CLIENT_EMAILS) ex.add(e.toLowerCase());
    for (const e of BUILTIN_LAUNCH_EXCLUDE_TRAINER_EMAILS) ex.add(e.toLowerCase());
    for (const e of getMatchFitInternalQaClientEmails()) ex.add(e.toLowerCase());
    for (const e of getMatchFitInternalQaTrainerEmails()) ex.add(e.toLowerCase());
  }
  return [...ex];
}

type EmailExcludeClause =
  | { email: { endsWith: string; mode: "insensitive" } }
  | { email: { in: string[] } };
type UsernameStartsWithExcludeClause = { username: { startsWith: string; mode: "insensitive" } };
type UsernameExactExcludeClause = { username: { in: string[]; mode: "insensitive" } };

function launchEmailExcludeOr(): EmailExcludeClause[] {
  const excluded = getLaunchExcludeEmails();
  return [
    { email: { endsWith: INTERNAL_SYNTHETIC_EMAIL_SUFFIX, mode: "insensitive" as const } },
    // Exclude all RFC 6761 .invalid TLD emails (test/demo/seed accounts)
    { email: { endsWith: ".invalid", mode: "insensitive" as const } },
    ...(excluded.length > 0 ? [{ email: { in: excluded } }] : []),
  ];
}

function launchUsernameExcludeOr(prefixes: readonly string[]): UsernameStartsWithExcludeClause[] {
  return prefixes.map((prefix) => ({
    username: { startsWith: prefix, mode: "insensitive" as const },
  }));
}

function launchUsernameExactExcludeOr(role: "client" | "trainer"): UsernameExactExcludeClause[] {
  const excluded = getLaunchExcludeUsernames(role);
  return excluded.length > 0 ? [{ username: { in: excluded, mode: "insensitive" as const } }] : [];
}

const DEV_CERT_PREFIXES = getMatchFitDevPlaceholderCertPathPrefixes();

function launchDevCertExcludeOr(): Prisma.TrainerWhereInput[] {
  return DEV_CERT_PREFIXES.flatMap((prefix) => [
    { profile: { is: { certificationUrl: { startsWith: prefix, mode: "insensitive" } } } },
    { profile: { is: { nutritionistCertificationUrl: { startsWith: prefix, mode: "insensitive" } } } },
    { profile: { is: { specialistCertificationUrl: { startsWith: prefix, mode: "insensitive" } } } },
  ]);
}

export const SYNTHETIC_TRAINER_USERNAME_PREFIX = "mfqst_";
export const SYNTHETIC_CLIENT_USERNAME_PREFIX = "mfqsc_";

/** Owner dev/test accounts from `scripts/seed-match-fit-dev-test-accounts.js` (never public launch totals). */
const BUILTIN_LAUNCH_EXCLUDE_CLIENT_USERNAMES = ["jbfitness6299"] as const;
const BUILTIN_LAUNCH_EXCLUDE_CLIENT_EMAILS = ["jonnybooth22@gmail.com"] as const;
const BUILTIN_LAUNCH_EXCLUDE_TRAINER_USERNAMES = ["coachjonny22"] as const;
const BUILTIN_LAUNCH_EXCLUDE_TRAINER_EMAILS = ["jb@northsideventuresgroup.com"] as const;

/** Usernames that must never count toward beta caps, founding promos, or public signup totals. */
export function getLaunchExcludeUsernames(role: "client" | "trainer"): string[] {
  const ex = new Set<string>([...betaExcludeCapCountUsernames()].map((u) => u.toLowerCase()));
  if (role === "client") {
    for (const u of BUILTIN_LAUNCH_EXCLUDE_CLIENT_USERNAMES) ex.add(u.toLowerCase());
    for (const u of getMatchFitLaunchExcludeClientUsernames()) ex.add(u.toLowerCase());
  } else {
    for (const u of BUILTIN_LAUNCH_EXCLUDE_TRAINER_USERNAMES) ex.add(u.toLowerCase());
    for (const u of getMatchFitLaunchExcludeTrainerUsernames()) ex.add(u.toLowerCase());
  }
  return [...ex];
}

/** Prisma filter for real launch signups (trainers). */
export function launchTrainerCountWhere(): Prisma.TrainerWhereInput {
  const usernameExcludes = [
    SYNTHETIC_TRAINER_USERNAME_PREFIX,
    ...getMatchFitLaunchExcludeTrainerUsernames(),
  ];

  return {
    deidentifiedAt: null,
    internalQaSyntheticPersona: false,
    NOT: {
      OR: [
        ...launchEmailExcludeOr(),
        ...launchUsernameExcludeOr(usernameExcludes),
        ...launchUsernameExactExcludeOr("trainer"),
        ...launchDevCertExcludeOr(),
      ],
    },
  };
}

/** Prisma filter for real launch signups (clients). */
export function launchClientCountWhere(): Prisma.ClientWhereInput {
  const usernameExcludes = [
    SYNTHETIC_CLIENT_USERNAME_PREFIX,
    ...getMatchFitLaunchExcludeClientUsernames(),
  ];

  return {
    deidentifiedAt: null,
    internalQaSyntheticPersona: false,
    NOT: {
      OR: [
        ...launchEmailExcludeOr(),
        ...launchUsernameExcludeOr(usernameExcludes),
        ...launchUsernameExactExcludeOr("client"),
      ],
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
