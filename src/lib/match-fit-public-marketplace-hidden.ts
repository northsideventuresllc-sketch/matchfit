import type { Prisma } from "@/generated/prisma/client";
import {
  INTERNAL_SYNTHETIC_EMAIL_SUFFIX,
  SYNTHETIC_CLIENT_USERNAME_PREFIX,
  SYNTHETIC_TRAINER_USERNAME_PREFIX,
  getLaunchExcludeEmails,
  getLaunchExcludeUsernames,
} from "@/lib/launch-account-counts";
import {
  getMatchFitDevPlaceholderCertPathPrefixes,
  getMatchFitLaunchExcludeClientUsernames,
  getMatchFitLaunchExcludeTrainerUsernames,
  MATCH_FIT_INTEGRATION_TEST_EMAIL_SUFFIX,
} from "@/lib/match-fit-launch-exclude-accounts";

/**
 * Owner production test portals — remain in launch/home totals but invisible on public discovery,
 * FitHub feeds, daily questionnaires, and public profile pages (except to the signed-in owner).
 */
export const MATCH_FIT_BUILTIN_OWNER_HIDDEN_LIVE_CLIENT_EMAILS = [
  "northsideofficial100@gmail.com",
] as const;

export const MATCH_FIT_BUILTIN_OWNER_HIDDEN_LIVE_TRAINER_EMAILS = [
  "jb@northsideventures.com",
] as const;

function parseCsvLower(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function identEmail(raw: string | undefined): string | null {
  const v = raw?.trim().toLowerCase();
  if (!v || !v.includes("@")) return null;
  return v;
}

export function getOwnerHiddenLiveClientEmails(): string[] {
  const ex = new Set<string>(MATCH_FIT_BUILTIN_OWNER_HIDDEN_LIVE_CLIENT_EMAILS.map((e) => e.toLowerCase()));
  for (const e of parseCsvLower(process.env.MATCH_FIT_OWNER_HIDDEN_LIVE_CLIENT_EMAILS)) ex.add(e);
  const dev = identEmail(process.env.MATCH_FIT_OWNER_HIDDEN_LIVE_CLIENT_IDENTIFIER);
  if (dev) ex.add(dev);
  return [...ex];
}

export function getOwnerHiddenLiveTrainerEmails(): string[] {
  const ex = new Set<string>(MATCH_FIT_BUILTIN_OWNER_HIDDEN_LIVE_TRAINER_EMAILS.map((e) => e.toLowerCase()));
  for (const e of parseCsvLower(process.env.MATCH_FIT_OWNER_HIDDEN_LIVE_TRAINER_EMAILS)) ex.add(e);
  const dev = identEmail(process.env.MATCH_FIT_OWNER_HIDDEN_LIVE_TRAINER_IDENTIFIER);
  if (dev) ex.add(dev);
  return [...ex];
}

function hiddenEmailsForRole(role: "client" | "trainer"): string[] {
  const ownerHidden = role === "client" ? getOwnerHiddenLiveClientEmails() : getOwnerHiddenLiveTrainerEmails();
  return [...new Set([...getLaunchExcludeEmails(role), ...ownerHidden].map((e) => e.toLowerCase()))];
}

function hiddenEmailOr(role: "client" | "trainer"): Prisma.ClientWhereInput[] {
  const excluded = hiddenEmailsForRole(role);
  return [
    { email: { endsWith: INTERNAL_SYNTHETIC_EMAIL_SUFFIX, mode: "insensitive" } },
    { email: { endsWith: ".invalid", mode: "insensitive" } },
    { email: { endsWith: MATCH_FIT_INTEGRATION_TEST_EMAIL_SUFFIX, mode: "insensitive" } },
    ...(excluded.length > 0 ? [{ email: { in: excluded } }] : []),
  ];
}

function hiddenUsernamePrefixOr(prefix: string): Prisma.ClientWhereInput[] {
  return [{ username: { startsWith: prefix, mode: "insensitive" } }];
}

function hiddenUsernameInOr(usernames: string[]): Prisma.ClientWhereInput[] {
  if (!usernames.length) return [];
  return [{ username: { in: usernames, mode: "insensitive" } }];
}

function hiddenTrainerCertOr(): Prisma.TrainerWhereInput[] {
  const certPrefixes = getMatchFitDevPlaceholderCertPathPrefixes();
  return certPrefixes.flatMap((prefix) => [
    { profile: { is: { certificationUrl: { startsWith: prefix, mode: "insensitive" as const } } } },
    { profile: { is: { nutritionistCertificationUrl: { startsWith: prefix, mode: "insensitive" as const } } } },
    { profile: { is: { specialistCertificationUrl: { startsWith: prefix, mode: "insensitive" as const } } } },
  ]);
}

function hiddenTrainerOr(): Prisma.TrainerWhereInput[] {
  const usernamePrefixes = [SYNTHETIC_TRAINER_USERNAME_PREFIX, ...getMatchFitLaunchExcludeTrainerUsernames()];
  const exactUsernames = getLaunchExcludeUsernames("trainer");
  return [
    { internalQaSyntheticPersona: true },
    ...(hiddenEmailOr("trainer") as unknown as Prisma.TrainerWhereInput[]),
    ...usernamePrefixes.flatMap(
      (prefix) => hiddenUsernamePrefixOr(prefix) as unknown as Prisma.TrainerWhereInput[],
    ),
    ...(hiddenUsernameInOr(exactUsernames) as unknown as Prisma.TrainerWhereInput[]),
    ...hiddenTrainerCertOr(),
  ];
}

function hiddenClientOr(): Prisma.ClientWhereInput[] {
  const usernamePrefixes = [SYNTHETIC_CLIENT_USERNAME_PREFIX, ...getMatchFitLaunchExcludeClientUsernames()];
  const exactUsernames = getLaunchExcludeUsernames("client");
  return [
    { internalQaSyntheticPersona: true },
    ...hiddenEmailOr("client"),
    ...usernamePrefixes.flatMap((prefix) => hiddenUsernamePrefixOr(prefix)),
    ...hiddenUsernameInOr(exactUsernames),
  ];
}

/** Trainers that may appear in client browse, FitHub, featured modules, and daily questionnaires. */
export function publicMarketplaceVisibleTrainerWhere(): Prisma.TrainerWhereInput {
  return {
    deidentifiedAt: null,
    accountDeletionFinalizeAt: null,
    NOT: { OR: hiddenTrainerOr() },
  };
}

/** Clients that may appear in trainer discovery and public client profiles. */
export function publicMarketplaceVisibleClientWhere(): Prisma.ClientWhereInput {
  return {
    deidentifiedAt: null,
    accountDeletionFinalizeAt: null,
    NOT: { OR: hiddenClientOr() },
  };
}

type TrainerIdentity = {
  email: string;
  username: string;
  internalQaSyntheticPersona?: boolean | null;
};

type ClientIdentity = {
  email: string;
  username: string;
  internalQaSyntheticPersona?: boolean | null;
};

function emailHidden(email: string, role: "client" | "trainer"): boolean {
  const e = email.trim().toLowerCase();
  if (e.endsWith(INTERNAL_SYNTHETIC_EMAIL_SUFFIX)) return true;
  if (e.endsWith(".invalid")) return true;
  if (e.endsWith(MATCH_FIT_INTEGRATION_TEST_EMAIL_SUFFIX)) return true;
  return hiddenEmailsForRole(role).includes(e);
}

function usernameHidden(username: string, role: "client" | "trainer"): boolean {
  const u = username.trim().toLowerCase();
  const prefix = role === "client" ? SYNTHETIC_CLIENT_USERNAME_PREFIX : SYNTHETIC_TRAINER_USERNAME_PREFIX;
  if (u.startsWith(prefix.toLowerCase())) return true;
  const launchPrefixes = role === "client" ? getMatchFitLaunchExcludeClientUsernames() : getMatchFitLaunchExcludeTrainerUsernames();
  if (launchPrefixes.some((p) => u.startsWith(p.toLowerCase()))) return true;
  const excluded = getLaunchExcludeUsernames(role);
  return excluded.some((x) => x.toLowerCase() === u);
}

export function isTrainerHiddenFromPublicMarketplace(row: TrainerIdentity): boolean {
  if (row.internalQaSyntheticPersona) return true;
  if (emailHidden(row.email, "trainer")) return true;
  if (usernameHidden(row.username, "trainer")) return true;
  return false;
}

export function isClientHiddenFromPublicMarketplace(row: ClientIdentity): boolean {
  if (row.internalQaSyntheticPersona) return true;
  if (emailHidden(row.email, "client")) return true;
  if (usernameHidden(row.username, "client")) return true;
  return false;
}
