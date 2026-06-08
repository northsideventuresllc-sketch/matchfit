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

const BUILTIN_LAUNCH_EXCLUDE_CLIENT_USERNAMES = ["jbfitness6299", "jonnybronny"] as const;
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

/** Trainer rows that pass launch exclusion filters (may still be pre–Terms of Service). */
export function launchTrainerAccountWhere(): Prisma.TrainerWhereInput {
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

/** Launch trainers — counted on the platform only after Terms of Service are accepted. */
export function launchTrainerCountWhere(): Prisma.TrainerWhereInput {
  return {
    ...launchTrainerAccountWhere(),
    profile: { is: { hasSignedTOS: true } },
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

export function launchPremiumTrainerCountWhere(): Prisma.TrainerProfileWhereInput {
  return {
    premiumStudioEnabledAt: { not: null },
    trainer: launchTrainerCountWhere(),
  };
}

/** Active platform subscription rows that count toward launch metrics (excludes sandbox billing). */
export function launchClientActiveSubscriptionCountWhere(): Prisma.ClientWhereInput {
  return {
    ...launchClientCountWhere(),
    stripeSubscriptionActive: true,
  };
}

/** Paying launch subscribers — requires live Stripe billing mode. */
export function launchClientPayingSubscriberCountWhere(): Prisma.ClientWhereInput {
  return launchPlatformSubscriberCountWhere();
}

/** Non-expired client sign-ups still in the registration hold flow (2FA or Stripe checkout). */
export const ACTIVE_PENDING_CLIENT_REGISTRATION_STATUSES = ["PENDING_2FA", "AWAITING_PAYMENT"] as const;

export function activePendingClientRegistrationWhere(now = new Date()): Prisma.PendingClientRegistrationWhereInput {
  return {
    status: { in: [...ACTIVE_PENDING_CLIENT_REGISTRATION_STATUSES] },
    expiresAt: { gt: now },
  };
}

/** Card-free founding trial (`platformTrialEndsAt`) without an active Stripe subscription. */
export function launchClientPlatformTrialCountWhere(now = new Date()): Prisma.ClientWhereInput {
  return {
    ...launchClientCountWhere(),
    accountDeactivatedAt: null,
    platformTrialEndsAt: { gt: now },
    NOT: {
      AND: [
        { stripeSubscriptionActive: true },
        { stripeSubscriptionId: { not: null } },
        { stripeSubscriptionId: { not: "" } },
      ],
    },
  };
}

/** Stripe subscription started but no paid invoice yet (legacy checkout path). */
export function launchClientStripeTrialCountWhere(): Prisma.ClientWhereInput {
  return {
    ...launchClientActiveSubscriptionCountWhere(),
    stripeLastSubscriptionInvoicePaidAt: null,
    AND: [{ stripeSubscriptionId: { not: null } }, { stripeSubscriptionId: { not: "" } }],
  };
}

/** Launch clients in any free-trial phase (card-free platform trial or Stripe trial). */
export function launchClientFreeTrialCountWhere(now = new Date()): Prisma.ClientWhereInput {
  return {
    ...launchClientCountWhere(),
    OR: [launchClientPlatformTrialCountWhere(now), launchClientStripeTrialCountWhere()],
  };
}

/** After platform trial ends: grace window before card/subscription is required. */
export function launchClientPlatformPaymentGraceWhere(now = new Date()): Prisma.ClientWhereInput {
  return {
    ...launchClientCountWhere(),
    accountDeactivatedAt: null,
    paymentGraceUntil: { gt: now },
    NOT: { platformTrialEndsAt: { gt: now } },
  };
}

/** Trainer account exists but marketplace dashboard is not live yet. */
export function launchTrainerIncompleteSignupWhere(): Prisma.TrainerWhereInput {
  return {
    ...launchTrainerAccountWhere(),
    profile: { is: { dashboardActivatedAt: null } },
  };
}

/** Trainer has not paid the registration fee / unlocked limited dashboard (new signup flow). */
export function launchTrainerBeforeRegistrationPaymentWhere(): Prisma.TrainerWhereInput {
  return {
    ...launchTrainerCountWhere(),
    profile: {
      is: {
        hasPaidRegistrationFee: false,
        limitedDashboardUnlockedAt: null,
        registrationFeeHoldStatus: { notIn: ["HELD", "CAPTURED"] },
      },
    },
  };
}

/** Trainer row exists but Terms of Service not accepted yet. */
export function launchTrainerBeforeTermsWhere(): Prisma.TrainerWhereInput {
  return {
    ...launchTrainerAccountWhere(),
    profile: { is: { hasSignedTOS: false } },
  };
}

export async function getActivePendingClientRegistrationStats(now = new Date()): Promise<{
  total: number;
  byStatus: Record<string, number>;
}> {
  const rows = await prisma.pendingClientRegistration.groupBy({
    by: ["status"],
    where: activePendingClientRegistrationWhere(now),
    _count: { _all: true },
  });
  const byStatus = Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
  const total = rows.reduce((sum, row) => sum + row._count._all, 0);
  return { total, byStatus };
}

export function launchClientBillingGraceWhere(now = new Date()): Prisma.ClientWhereInput {
  return {
    ...launchClientCountWhere(),
    subscriptionGraceUntil: { gte: now },
    stripeSubscriptionActive: false,
  };
}

export function launchClientWithCardWhere(): Prisma.ClientWhereInput {
  return {
    ...launchClientCountWhere(),
    stripeCustomerId: { not: null },
  };
}

export async function countLaunchPlatformSubscribers(): Promise<number> {
  return prisma.client.count({ where: launchPlatformSubscriberCountWhere() });
}

export async function countLaunchPremiumTrainers(): Promise<number> {
  return prisma.trainerProfile.count({ where: launchPremiumTrainerCountWhere() });
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

export async function countPendingClientRegistrations(now = new Date()): Promise<number> {
  return prisma.pendingClientRegistration.count({
    where: activePendingClientRegistrationWhere(now),
  });
}
