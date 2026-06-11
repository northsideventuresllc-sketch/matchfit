import type { Prisma } from "@/generated/prisma/client";
import { Prisma as PrismaNamespace } from "@/generated/prisma/client";
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
import {
  MATCH_FIT_ADMIN_REDACT_CLIENT_USERNAMES,
  MATCH_FIT_ADMIN_REDACT_TRAINER_USERNAMES,
} from "@/lib/match-fit-production-member-excludes";

/** Owner QA portals — email redacted in admin member search only (still counted if real). */
export const ADMIN_OWNER_TEST_CLIENT_USERNAMES = MATCH_FIT_ADMIN_REDACT_CLIENT_USERNAMES;
export const ADMIN_OWNER_TEST_TRAINER_USERNAMES = MATCH_FIT_ADMIN_REDACT_TRAINER_USERNAMES;

export const ADMIN_REDACTED_EMAIL_LABEL = "Email hidden (owner test account)";

const OWNER_CLIENT_USERNAMES_LOWER = ADMIN_OWNER_TEST_CLIENT_USERNAMES.map((u) => u.toLowerCase());
const OWNER_TRAINER_USERNAMES_LOWER = ADMIN_OWNER_TEST_TRAINER_USERNAMES.map((u) => u.toLowerCase());

export function isAdminOwnerTestUsername(username: string, kind: "client" | "trainer"): boolean {
  const u = username.trim().toLowerCase();
  if (kind === "client") return OWNER_CLIENT_USERNAMES_LOWER.includes(u);
  return OWNER_TRAINER_USERNAMES_LOWER.includes(u);
}

export function redactEmailForAdminPortal(
  email: string,
  username: string,
  kind: "client" | "trainer",
): string {
  if (isAdminOwnerTestUsername(username, kind)) return ADMIN_REDACTED_EMAIL_LABEL;
  return email;
}

function launchExcludeEmailsLower(): string[] {
  return [...new Set(getLaunchExcludeEmails().map((e) => e.toLowerCase()))];
}

function launchExcludeClientUsernamesForAdminPortal(): string[] {
  return [...new Set(getMatchFitLaunchExcludeClientUsernames().map((u) => u.toLowerCase()))];
}

function launchExcludeTrainerUsernamesForAdminPortal(): string[] {
  return [...new Set(getMatchFitLaunchExcludeTrainerUsernames().map((u) => u.toLowerCase()))];
}

function emailPatternExcludeOr(): Prisma.ClientWhereInput[] {
  const excluded = launchExcludeEmailsLower();
  return [
    { email: { endsWith: INTERNAL_SYNTHETIC_EMAIL_SUFFIX, mode: "insensitive" } },
    { email: { endsWith: ".invalid", mode: "insensitive" } },
    { email: { endsWith: MATCH_FIT_INTEGRATION_TEST_EMAIL_SUFFIX, mode: "insensitive" } },
    ...(excluded.length > 0 ? [{ email: { in: excluded } }] : []),
  ];
}

function usernamePrefixExcludeOr(prefix: string): Prisma.ClientWhereInput[] {
  return [{ username: { startsWith: prefix, mode: "insensitive" } }];
}

function launchUsernameEqualsExcludeOr(usernames: string[]): Prisma.ClientWhereInput[] {
  return usernames.map((username) => ({
    username: { equals: username, mode: "insensitive" as const },
  }));
}

function fakeClientOr(): Prisma.ClientWhereInput[] {
  return [
    ...emailPatternExcludeOr(),
    ...usernamePrefixExcludeOr(SYNTHETIC_CLIENT_USERNAME_PREFIX),
    ...launchUsernameEqualsExcludeOr(launchExcludeClientUsernamesForAdminPortal()),
  ];
}

function fakeTrainerOr(): Prisma.TrainerWhereInput[] {
  return [
    ...(emailPatternExcludeOr() as unknown as Prisma.TrainerWhereInput[]),
    ...(usernamePrefixExcludeOr(SYNTHETIC_TRAINER_USERNAME_PREFIX) as unknown as Prisma.TrainerWhereInput[]),
    ...(launchUsernameEqualsExcludeOr(launchExcludeTrainerUsernamesForAdminPortal()) as unknown as Prisma.TrainerWhereInput[]),
  ];
}

function adminPortalClientListWhereBase(includeSyntheticColumn: boolean): Prisma.ClientWhereInput {
  return {
    deidentifiedAt: null,
    ...(includeSyntheticColumn ? { internalQaSyntheticPersona: false } : {}),
    NOT: {
      OR: [...fakeClientOr()],
    },
  };
}

function adminPortalTrainerListWhereBase(
  includeSyntheticColumn: boolean,
  includeDeidentified: boolean,
): Prisma.TrainerWhereInput {
  return {
    ...(includeDeidentified ? {} : { deidentifiedAt: null }),
    ...(includeSyntheticColumn ? { internalQaSyntheticPersona: false } : {}),
    NOT: {
      OR: [...fakeTrainerOr()],
    },
  };
}

/** Prisma filter: real members only; excludes owner test portals, synthetic / QA fake personas. */
export function adminPortalClientListWhere(): Prisma.ClientWhereInput {
  return adminPortalClientListWhereBase(true);
}

/** Same as {@link adminPortalClientListWhere} when `internalQaSyntheticPersona` is not migrated yet. */
export function adminPortalClientListWhereLegacy(): Prisma.ClientWhereInput {
  return adminPortalClientListWhereBase(false);
}

/** Prisma filter: real trainers only; excludes owner test portals and synthetic QA personas (signup log). */
export function adminPortalTrainerListWhere(): Prisma.TrainerWhereInput {
  return adminPortalTrainerListWhereBase(true, false);
}

/** Same as {@link adminPortalTrainerListWhere} when `internalQaSyntheticPersona` is not migrated yet. */
export function adminPortalTrainerListWhereLegacy(): Prisma.TrainerWhereInput {
  return adminPortalTrainerListWhereBase(false, false);
}

/** Member search / pipeline directory — includes deidentified trainers so admins can find removed accounts. */
export function adminPortalTrainerDirectoryWhere(): Prisma.TrainerWhereInput {
  return adminPortalTrainerListWhereBase(true, true);
}

/** Legacy directory filter when `internalQaSyntheticPersona` is not migrated yet. */
export function adminPortalTrainerDirectoryWhereLegacy(): Prisma.TrainerWhereInput {
  return adminPortalTrainerListWhereBase(false, true);
}

/**
 * Pending trainers for admin pipeline — includes deidentified accounts and trainers without profiles.
 * Dev-placeholder certification URLs do not exclude rows (admin-only view).
 */
export function adminPendingTrainerWhere(): Prisma.TrainerWhereInput {
  return {
    ...adminPortalTrainerDirectoryWhere(),
    NOT: {
      profile: { is: { dashboardActivatedAt: { not: null } } },
    },
    OR: [
      { termsAcceptedAt: { not: null } },
      { profile: { is: { hasSignedTOS: true } } },
      { profile: { is: { complianceWindowStartedAt: { not: null } } } },
      { profile: { is: { limitedDashboardUnlockedAt: { not: null } } } },
      {
        profile: {
          is: {
            registrationFeeHoldStatus: { in: ["HELD", "CAPTURED"] },
          },
        },
      },
    ],
  };
}

function sqlInList(values: string[]): PrismaNamespace.Sql {
  return PrismaNamespace.join(values.map((v) => PrismaNamespace.sql`${v}`));
}

/** Raw SQL fragment appended to client signup/directory queries (`c` alias). */
export function buildAdminPortalClientSqlFilter(): PrismaNamespace.Sql {
  const emails = launchExcludeEmailsLower();
  const extraUsernames = launchExcludeClientUsernamesForAdminPortal();

  const emailNotIn =
    emails.length > 0
      ? PrismaNamespace.sql`AND LOWER(c."email") NOT IN (${sqlInList(emails)})`
      : PrismaNamespace.empty;

  const usernameNotIn =
    extraUsernames.length > 0
      ? PrismaNamespace.sql`AND LOWER(c."username") NOT IN (${sqlInList(extraUsernames)})`
      : PrismaNamespace.empty;

  return PrismaNamespace.sql`
    AND COALESCE(c."internalQaSyntheticPersona", false) = false
    AND LOWER(c."username") NOT LIKE ${`${SYNTHETIC_CLIENT_USERNAME_PREFIX.toLowerCase()}%`}
    AND LOWER(c."email") NOT LIKE ${`%${INTERNAL_SYNTHETIC_EMAIL_SUFFIX}`}
    AND LOWER(c."email") NOT LIKE '%.invalid'
    AND LOWER(c."email") NOT LIKE ${`%${MATCH_FIT_INTEGRATION_TEST_EMAIL_SUFFIX}`}
    ${emailNotIn}
    ${usernameNotIn}
  `;
}

/** Raw SQL fragment appended to trainer signup/directory queries (`t` alias). */
export function buildAdminPortalTrainerSqlFilter(): PrismaNamespace.Sql {
  const emails = launchExcludeEmailsLower();
  const extraUsernames = launchExcludeTrainerUsernamesForAdminPortal();

  const emailNotIn =
    emails.length > 0
      ? PrismaNamespace.sql`AND LOWER(t."email") NOT IN (${sqlInList(emails)})`
      : PrismaNamespace.empty;

  const usernameNotIn =
    extraUsernames.length > 0
      ? PrismaNamespace.sql`AND LOWER(t."username") NOT IN (${sqlInList(extraUsernames)})`
      : PrismaNamespace.empty;

  return PrismaNamespace.sql`
    AND COALESCE(t."internalQaSyntheticPersona", false) = false
    AND LOWER(t."username") NOT LIKE ${`${SYNTHETIC_TRAINER_USERNAME_PREFIX.toLowerCase()}%`}
    AND LOWER(t."email") NOT LIKE ${`%${INTERNAL_SYNTHETIC_EMAIL_SUFFIX}`}
    AND LOWER(t."email") NOT LIKE '%.invalid'
    AND LOWER(t."email") NOT LIKE ${`%${MATCH_FIT_INTEGRATION_TEST_EMAIL_SUFFIX}`}
    ${emailNotIn}
    ${usernameNotIn}
  `;
}

/** Admin pipeline SQL — same as list filter but includes deidentified trainers. */
export function buildAdminPortalTrainerDirectorySqlFilter(): PrismaNamespace.Sql {
  return buildAdminPortalTrainerSqlFilter();
}

/** Fallback when `internalQaSyntheticPersona` column is missing — still excludes obvious fake rows. */
export function buildAdminPortalClientSqlFilterLegacy(): PrismaNamespace.Sql {
  const emails = launchExcludeEmailsLower();
  const extraUsernames = launchExcludeClientUsernamesForAdminPortal();

  const emailNotIn =
    emails.length > 0
      ? PrismaNamespace.sql`AND LOWER(c."email") NOT IN (${sqlInList(emails)})`
      : PrismaNamespace.empty;

  const usernameNotIn =
    extraUsernames.length > 0
      ? PrismaNamespace.sql`AND LOWER(c."username") NOT IN (${sqlInList(extraUsernames)})`
      : PrismaNamespace.empty;

  return PrismaNamespace.sql`
    AND LOWER(c."username") NOT LIKE ${`${SYNTHETIC_CLIENT_USERNAME_PREFIX.toLowerCase()}%`}
    AND LOWER(c."email") NOT LIKE ${`%${INTERNAL_SYNTHETIC_EMAIL_SUFFIX}`}
    AND LOWER(c."email") NOT LIKE '%.invalid'
    AND LOWER(c."email") NOT LIKE ${`%${MATCH_FIT_INTEGRATION_TEST_EMAIL_SUFFIX}`}
    ${emailNotIn}
    ${usernameNotIn}
  `;
}

/** Raw SQL for launch metrics on clients — excludes owner test accounts and all QA/synthetic rows. */
export function buildLaunchMetricsClientSqlFilter(alias = "c"): PrismaNamespace.Sql {
  const emails = getLaunchExcludeEmails("client").map((e) => e.toLowerCase());
  const usernames = getLaunchExcludeUsernames("client").map((u) => u.toLowerCase());
  const col = (name: string) => PrismaNamespace.raw(`"${alias}"."${name}"`);

  const emailNotIn =
    emails.length > 0
      ? PrismaNamespace.sql`AND LOWER(${col("email")}) NOT IN (${sqlInList(emails)})`
      : PrismaNamespace.empty;

  const usernameNotIn =
    usernames.length > 0
      ? PrismaNamespace.sql`AND LOWER(${col("username")}) NOT IN (${sqlInList(usernames)})`
      : PrismaNamespace.empty;

  return PrismaNamespace.sql`
    AND COALESCE(${col("internalQaSyntheticPersona")}, false) = false
    AND LOWER(${col("username")}) NOT LIKE ${`${SYNTHETIC_CLIENT_USERNAME_PREFIX.toLowerCase()}%`}
    AND LOWER(${col("email")}) NOT LIKE ${`%${INTERNAL_SYNTHETIC_EMAIL_SUFFIX}`}
    AND LOWER(${col("email")}) NOT LIKE '%.invalid'
    AND LOWER(${col("email")}) NOT LIKE ${`%${MATCH_FIT_INTEGRATION_TEST_EMAIL_SUFFIX}`}
    ${emailNotIn}
    ${usernameNotIn}
  `;
}

/** Raw SQL for launch metrics on trainers — excludes owner test accounts and dev-seed personas. */
export function buildLaunchMetricsTrainerSqlFilter(
  trainerAlias = "t",
  profileAlias?: string,
): PrismaNamespace.Sql {
  const emails = getLaunchExcludeEmails("trainer").map((e) => e.toLowerCase());
  const usernames = getLaunchExcludeUsernames("trainer").map((u) => u.toLowerCase());
  const tCol = (name: string) => PrismaNamespace.raw(`"${trainerAlias}"."${name}"`);
  const certPrefixes = getMatchFitDevPlaceholderCertPathPrefixes();

  const emailNotIn =
    emails.length > 0
      ? PrismaNamespace.sql`AND LOWER(${tCol("email")}) NOT IN (${sqlInList(emails)})`
      : PrismaNamespace.empty;

  const usernameNotIn =
    usernames.length > 0
      ? PrismaNamespace.sql`AND LOWER(${tCol("username")}) NOT IN (${sqlInList(usernames)})`
      : PrismaNamespace.empty;

  const certChecks =
    profileAlias && certPrefixes.length > 0
      ? certPrefixes.map(
          (prefix) => PrismaNamespace.sql`
            COALESCE(${PrismaNamespace.raw(`"${profileAlias}"."certificationUrl"`)}, '') NOT ILIKE ${`${prefix}%`}
            AND COALESCE(${PrismaNamespace.raw(`"${profileAlias}"."nutritionistCertificationUrl"`)}, '') NOT ILIKE ${`${prefix}%`}
            AND COALESCE(${PrismaNamespace.raw(`"${profileAlias}"."specialistCertificationUrl"`)}, '') NOT ILIKE ${`${prefix}%`}
          `,
        )
      : [];

  const certBlock =
    certChecks.length > 0
      ? PrismaNamespace.sql`AND (${PrismaNamespace.join(certChecks, " AND ")})`
      : PrismaNamespace.empty;

  return PrismaNamespace.sql`
    AND COALESCE(${tCol("internalQaSyntheticPersona")}, false) = false
    AND LOWER(${tCol("username")}) NOT LIKE ${`${SYNTHETIC_TRAINER_USERNAME_PREFIX.toLowerCase()}%`}
    AND LOWER(${tCol("email")}) NOT LIKE ${`%${INTERNAL_SYNTHETIC_EMAIL_SUFFIX}`}
    AND LOWER(${tCol("email")}) NOT LIKE '%.invalid'
    AND LOWER(${tCol("email")}) NOT LIKE ${`%${MATCH_FIT_INTEGRATION_TEST_EMAIL_SUFFIX}`}
    ${emailNotIn}
    ${usernameNotIn}
    ${certBlock}
  `;
}

export function buildAdminPortalTrainerSqlFilterLegacy(): PrismaNamespace.Sql {
  const emails = launchExcludeEmailsLower();
  const extraUsernames = launchExcludeTrainerUsernamesForAdminPortal();

  const emailNotIn =
    emails.length > 0
      ? PrismaNamespace.sql`AND LOWER(t."email") NOT IN (${sqlInList(emails)})`
      : PrismaNamespace.empty;

  const usernameNotIn =
    extraUsernames.length > 0
      ? PrismaNamespace.sql`AND LOWER(t."username") NOT IN (${sqlInList(extraUsernames)})`
      : PrismaNamespace.empty;

  return PrismaNamespace.sql`
    AND LOWER(t."username") NOT LIKE ${`${SYNTHETIC_TRAINER_USERNAME_PREFIX.toLowerCase()}%`}
    AND LOWER(t."email") NOT LIKE ${`%${INTERNAL_SYNTHETIC_EMAIL_SUFFIX}`}
    AND LOWER(t."email") NOT LIKE '%.invalid'
    AND LOWER(t."email") NOT LIKE ${`%${MATCH_FIT_INTEGRATION_TEST_EMAIL_SUFFIX}`}
    ${emailNotIn}
    ${usernameNotIn}
  `;
}
