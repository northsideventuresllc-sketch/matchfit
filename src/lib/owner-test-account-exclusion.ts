import type { Prisma } from "@/generated/prisma/client";
import {
  MATCH_FIT_EXCLUDE_NON_PRODUCTION_CLIENT_USERNAMES,
  MATCH_FIT_EXCLUDE_NON_PRODUCTION_MEMBER_EMAILS,
  MATCH_FIT_EXCLUDE_NON_PRODUCTION_TRAINER_USERNAMES,
} from "@/lib/match-fit-production-member-excludes";

const CLIENT_USERNAMES_LOWER = new Set(
  MATCH_FIT_EXCLUDE_NON_PRODUCTION_CLIENT_USERNAMES.map((u) => u.toLowerCase()),
);
const TRAINER_USERNAMES_LOWER = new Set(
  MATCH_FIT_EXCLUDE_NON_PRODUCTION_TRAINER_USERNAMES.map((u) => u.toLowerCase()),
);
const ALL_USERNAMES_LOWER = new Set([...CLIENT_USERNAMES_LOWER, ...TRAINER_USERNAMES_LOWER]);
const EXCLUDED_EMAILS_LOWER = new Set(
  MATCH_FIT_EXCLUDE_NON_PRODUCTION_MEMBER_EMAILS.map((e) => e.toLowerCase()),
);

export function normalizeOwnerTestUsername(username: string | null | undefined): string {
  return username?.trim().toLowerCase() ?? "";
}

export function normalizeOwnerTestEmail(email: string | null | undefined): string {
  return email?.trim().toLowerCase() ?? "";
}

/** Owner dev/QA portal username — must never appear in admin or member metrics. */
export function isOwnerTestAccountUsername(
  username: string | null | undefined,
  role?: "client" | "trainer",
): boolean {
  const u = normalizeOwnerTestUsername(username);
  if (!u) return false;
  if (role === "client") return CLIENT_USERNAMES_LOWER.has(u);
  if (role === "trainer") return TRAINER_USERNAMES_LOWER.has(u);
  return ALL_USERNAMES_LOWER.has(u);
}

export function isOwnerTestAccountEmail(email: string | null | undefined): boolean {
  const e = normalizeOwnerTestEmail(email);
  if (!e) return false;
  return EXCLUDED_EMAILS_LOWER.has(e);
}

export function isOwnerTestAccountIdentity(input: {
  username?: string | null;
  email?: string | null;
  role?: "client" | "trainer";
}): boolean {
  return isOwnerTestAccountUsername(input.username, input.role) || isOwnerTestAccountEmail(input.email);
}

function ownerTestIdentityExcludeOr(role?: "client" | "trainer"): Prisma.SignupFormProgressWhereInput[] {
  const usernames =
    role === "client"
      ? [...CLIENT_USERNAMES_LOWER]
      : role === "trainer"
        ? [...TRAINER_USERNAMES_LOWER]
        : [...ALL_USERNAMES_LOWER];

  const clauses: Prisma.SignupFormProgressWhereInput[] = [
    ...usernames.map((username) => ({ username: { equals: username, mode: "insensitive" as const } })),
    ...[...EXCLUDED_EMAILS_LOWER].map((email) => ({ email: { equals: email, mode: "insensitive" as const } })),
  ];
  return clauses;
}

/** Drop owner QA signup-progress rows from admin pipeline counts and lists. */
export function ownerTestExcludedSignupProgressWhere(
  role: "client" | "trainer",
): Prisma.SignupFormProgressWhereInput {
  const or = ownerTestIdentityExcludeOr(role);
  if (or.length === 0) return {};
  return { NOT: { OR: or } };
}

/** Drop owner QA pending registrations from admin client pipeline. */
export function ownerTestExcludedPendingRegistrationWhere(): Prisma.PendingClientRegistrationWhereInput {
  const or: Prisma.PendingClientRegistrationWhereInput[] = [
    ...[...ALL_USERNAMES_LOWER].map((username) => ({
      username: { equals: username, mode: "insensitive" as const },
    })),
    ...[...EXCLUDED_EMAILS_LOWER].map((email) => ({
      email: { equals: email, mode: "insensitive" as const },
    })),
  ];
  if (or.length === 0) return {};
  return { NOT: { OR: or } };
}

export function filterOwnerTestIdentities<T>(
  rows: T[],
  read: (row: T) => { username?: string | null; email?: string | null; role?: "client" | "trainer" },
): T[] {
  return rows.filter((row) => !isOwnerTestAccountIdentity(read(row)));
}
