import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { betaExcludeCapCountEmails } from "@/lib/beta-launch-config";
import {
  getMatchFitDevPlaceholderCertPathPrefixes,
  getMatchFitLaunchExcludeClientUsernames,
  getMatchFitLaunchExcludeEmails,
  getMatchFitLaunchExcludeTrainerUsernames,
  MATCH_FIT_INTEGRATION_TEST_EMAIL_SUFFIX,
} from "@/lib/match-fit-launch-exclude-accounts";

/** Auto-generated internal QA personas (see `internal-qa-simulation.ts`). */
export const INTERNAL_SYNTHETIC_EMAIL_SUFFIX = "@internal.match-fit.invalid";

export function isInternalSyntheticMatchFitEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(INTERNAL_SYNTHETIC_EMAIL_SUFFIX);
}

/** @deprecated Use getMatchFitLaunchExcludeEmails — kept for home-user-counts imports. */
export function getLaunchExcludeEmails(): string[] {
  const shared = new Set(getMatchFitLaunchExcludeEmails().map((e) => e.toLowerCase()));
  for (const e of betaExcludeCapCountEmails()) shared.add(e.toLowerCase());
  return [...shared];
}

function launchEmailExcludeOr(): Prisma.TrainerWhereInput["OR"] {
  const excluded = getLaunchExcludeEmails();
  return [
    { email: { endsWith: INTERNAL_SYNTHETIC_EMAIL_SUFFIX, mode: "insensitive" } },
    { email: { endsWith: ".invalid", mode: "insensitive" } },
    { email: { endsWith: MATCH_FIT_INTEGRATION_TEST_EMAIL_SUFFIX, mode: "insensitive" } },
    ...(excluded.length > 0 ? [{ email: { in: excluded } }] : []),
  ];
}

function launchUsernameExcludeOr(prefixes: readonly string[]): Prisma.TrainerWhereInput["OR"] {
  return prefixes.map((prefix) => ({
    username: { startsWith: prefix, mode: "insensitive" as const },
  }));
}

const DEV_CERT_PREFIXES = getMatchFitDevPlaceholderCertPathPrefixes();

function launchDevCertExcludeOr(): Prisma.TrainerWhereInput["OR"] {
  return DEV_CERT_PREFIXES.flatMap((prefix) => [
    { profile: { is: { certificationUrl: { startsWith: prefix, mode: "insensitive" } } } },
    { profile: { is: { nutritionistCertificationUrl: { startsWith: prefix, mode: "insensitive" } } } },
    { profile: { is: { specialistCertificationUrl: { startsWith: prefix, mode: "insensitive" } } } },
  ]);
}

export const SYNTHETIC_TRAINER_USERNAME_PREFIX = "mfqst_";
export const SYNTHETIC_CLIENT_USERNAME_PREFIX = "mfqsc_";

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
      OR: [...launchEmailExcludeOr(), ...launchUsernameExcludeOr(usernameExcludes)],
    },
  };
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
