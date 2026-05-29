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

export const INTERNAL_SYNTHETIC_EMAIL_SUFFIX = "@internal.match-fit.invalid";

export function isInternalSyntheticMatchFitEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(INTERNAL_SYNTHETIC_EMAIL_SUFFIX);
}

export function getLaunchExcludeEmails(role?: "client" | "trainer"): string[] {
  const ex = new Set<string>([...betaExcludeCapCountEmails()].map((e) => e.toLowerCase()));
  for (const e of getMatchFitLaunchExcludeEmails()) ex.add(e.toLowerCase());
  if (!role || role === "client") {
    for (const e of BUILTIN_LAUNCH_EXCLUDE_CLIENT_EMAILS) ex.add(e.toLowerCase());
  }
  if (!role || role === "trainer") {
    for (const e of BUILTIN_LAUNCH_EXCLUDE_TRAINER_EMAILS) ex.add(e.toLowerCase());
  }
  return [...ex];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWhereOrItem = Record<string, any>;

function launchEmailExcludeOr(role: "client" | "trainer"): AnyWhereOrItem[] {
  const excludedEmails = getLaunchExcludeEmails(role);
  return [
    { email: { endsWith: INTERNAL_SYNTHETIC_EMAIL_SUFFIX, mode: "insensitive" } },
    { email: { endsWith: ".invalid", mode: "insensitive" } },
    { email: { endsWith: MATCH_FIT_INTEGRATION_TEST_EMAIL_SUFFIX, mode: "insensitive" } },
    ...(excludedEmails.length > 0 ? [{ email: { in: excludedEmails } }] : []),
  ];
}

function launchUsernamePrefixExcludeOr(prefixes: readonly string[]): AnyWhereOrItem[] {
  return prefixes.map((prefix) => ({ username: { startsWith: prefix, mode: "insensitive" } }));
}

function launchUsernameInExcludeOr(usernames: string[]): AnyWhereOrItem[] {
  if (usernames.length === 0) return [];
  return [{ username: { in: usernames, mode: "insensitive" } }];
}

const DEV_CERT_PREFIXES = getMatchFitDevPlaceholderCertPathPrefixes();

function launchDevCertExcludeOr(): AnyWhereOrItem[] {
  return DEV_CERT_PREFIXES.flatMap((prefix) => [
    { profile: { is: { certificationUrl: { startsWith: prefix, mode: "insensitive" } } } },
    { profile: { is: { nutritionistCertificationUrl: { startsWith: prefix, mode: "insensitive" } } } },
    { profile: { is: { specialistCertificationUrl: { startsWith: prefix, mode: "insensitive" } } } },
  ]);
}

export const SYNTHETIC_TRAINER_USERNAME_PREFIX = "mfqst_";
export const SYNTHETIC_CLIENT_USERNAME_PREFIX = "mfqsc_";

const BUILTIN_LAUNCH_EXCLUDE_CLIENT_USERNAMES = ["jbfitness6299"] as const;
const BUILTIN_LAUNCH_EXCLUDE_CLIENT_EMAILS = ["jonnybooth22@gmail.com"] as const;
const BUILTIN_LAUNCH_EXCLUDE_TRAINER_USERNAMES = ["coachjonny22"] as const;
const BUILTIN_LAUNCH_EXCLUDE_TRAINER_EMAILS = ["jb@northsideventuresgroup.com"] as const;

export function getLaunchExcludeUsernames(role?: "client" | "trainer"): string[] {
  const ex = new Set<string>([...betaExcludeCapCountUsernames()].map((u) => u.toLowerCase()));
  if (!role || role === "client") {
    for (const u of BUILTIN_LAUNCH_EXCLUDE_CLIENT_USERNAMES) ex.add(u.toLowerCase());
    for (const u of getMatchFitLaunchExcludeClientUsernames()) ex.add(u.toLowerCase());
  }
  if (!role || role === "trainer") {
    for (const u of BUILTIN_LAUNCH_EXCLUDE_TRAINER_USERNAMES) ex.add(u.toLowerCase());
    for (const u of getMatchFitLaunchExcludeTrainerUsernames()) ex.add(u.toLowerCase());
  }
  return [...ex];
}

export function launchTrainerCountWhere(): Prisma.TrainerWhereInput {
  const usernameExcludes = [SYNTHETIC_TRAINER_USERNAME_PREFIX, ...getMatchFitLaunchExcludeTrainerUsernames()];
  const exactUsernameExcludes = getLaunchExcludeUsernames("trainer");
  return {
    deidentifiedAt: null,
    internalQaSyntheticPersona: false,
    NOT: {
      OR: [
        ...launchEmailExcludeOr("trainer"),
        ...launchUsernamePrefixExcludeOr(usernameExcludes),
        ...launchUsernameInExcludeOr(exactUsernameExcludes),
        ...launchDevCertExcludeOr(),
      ] as Prisma.TrainerWhereInput[],
    },
  };
}

export function launchClientCountWhere(): Prisma.ClientWhereInput {
  const usernameExcludes = [SYNTHETIC_CLIENT_USERNAME_PREFIX, ...getMatchFitLaunchExcludeClientUsernames()];
  const exactUsernameExcludes = getLaunchExcludeUsernames("client");
  return {
    deidentifiedAt: null,
    internalQaSyntheticPersona: false,
    NOT: {
      OR: [
        ...launchEmailExcludeOr("client"),
        ...launchUsernamePrefixExcludeOr(usernameExcludes),
        ...launchUsernameInExcludeOr(exactUsernameExcludes),
      ] as Prisma.ClientWhereInput[],
    },
  };
}

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

export async function countLaunchClients(): Promise<number> {
  return prisma.client.count({ where: launchClientCountWhere() });
}

export async function countLaunchTrainers(): Promise<number> {
  return prisma.trainer.count({ where: launchTrainerCountWhere() });
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
