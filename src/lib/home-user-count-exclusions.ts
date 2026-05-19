import { Prisma } from "@prisma/client";

function parseCommaList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseLowerEmailList(raw: string | undefined): string[] {
  return [...new Set(parseCommaList(raw).map((e) => e.toLowerCase()))];
}

function parseLowerUsernameList(raw: string | undefined): string[] {
  return [...new Set(parseCommaList(raw).map((u) => u.toLowerCase()))];
}

function classifyDevIdentifier(value: string | undefined): {
  emails: string[];
  usernames: string[];
  phones: string[];
} {
  const v = value?.trim();
  if (!v) return { emails: [], usernames: [], phones: [] };
  if (v.includes("@")) return { emails: [v.toLowerCase()], usernames: [], phones: [] };
  const digits = v.replace(/\D/g, "");
  if (digits.length >= 10) return { emails: [], usernames: [], phones: [v, digits, `+${digits}`] };
  return { emails: [], usernames: [v.toLowerCase()], phones: [] };
}

/** Emails that must never appear in public homepage user totals. */
export function getHomeUserCountExcludedEmails(): string[] {
  const devClient = classifyDevIdentifier(process.env.MATCH_FIT_DEV_CLIENT_IDENTIFIER);
  const devTrainer = classifyDevIdentifier(process.env.MATCH_FIT_DEV_TRAINER_IDENTIFIER);
  return [
    ...new Set([
      ...parseLowerEmailList(process.env.MATCH_FIT_INTERNAL_QA_CLIENT_EMAILS),
      ...parseLowerEmailList(process.env.MATCH_FIT_INTERNAL_QA_TRAINER_EMAILS),
      ...parseLowerEmailList(process.env.MATCH_FIT_LAUNCH_COHORT_EXCLUDED_EMAILS),
      ...devClient.emails,
      ...devTrainer.emails,
    ]),
  ];
}

/** Usernames that must never appear in public homepage user totals. */
export function getHomeUserCountExcludedUsernames(): string[] {
  const devClient = classifyDevIdentifier(process.env.MATCH_FIT_DEV_CLIENT_IDENTIFIER);
  const devTrainer = classifyDevIdentifier(process.env.MATCH_FIT_DEV_TRAINER_IDENTIFIER);
  return [
    ...new Set([
      ...parseLowerUsernameList(process.env.MATCH_FIT_TEST_TRAINER_USERNAMES),
      ...parseLowerUsernameList(process.env.MATCH_FIT_FITHUB_DEMO_TRAINER_USERNAMES),
      ...devClient.usernames,
      ...devTrainer.usernames,
    ]),
  ];
}

export function getHomeUserCountExcludedPhones(): string[] {
  const devClient = classifyDevIdentifier(process.env.MATCH_FIT_DEV_CLIENT_IDENTIFIER);
  const devTrainer = classifyDevIdentifier(process.env.MATCH_FIT_DEV_TRAINER_IDENTIFIER);
  return [...new Set([...devClient.phones, ...devTrainer.phones])];
}

function sqlNotInLower(column: Prisma.Sql, values: string[]): Prisma.Sql {
  if (!values.length) return Prisma.empty;
  return Prisma.sql`AND LOWER(${column}) NOT IN (${Prisma.join(values.map((v) => Prisma.sql`${v}`))})`;
}

function sqlNotInExact(column: Prisma.Sql, values: string[]): Prisma.Sql {
  if (!values.length) return Prisma.empty;
  return Prisma.sql`AND ${column} NOT IN (${Prisma.join(values.map((v) => Prisma.sql`${v}`))})`;
}

/**
 * SQL fragment: row is a real member for homepage marketing counts (trainers table alias `t`).
 */
export function homeUserCountTrainerWhereSql(options: {
  excludeInternalQaSynthetic: boolean;
}): Prisma.Sql {
  const excludedEmails = getHomeUserCountExcludedEmails();
  const excludedUsernames = getHomeUserCountExcludedUsernames();
  const excludedPhones = getHomeUserCountExcludedPhones();

  const synthClause = options.excludeInternalQaSynthetic
    ? Prisma.sql`AND t."internalQaSyntheticPersona" = false`
    : Prisma.empty;

  return Prisma.sql`
    ${synthClause}
    AND LOWER(t."email") NOT LIKE '%@internal.match-fit.invalid'
    AND LOWER(t."email") NOT LIKE '%@demo.matchfit.invalid'
    AND t."username" NOT LIKE 'mf_demo_feat_%'
    AND t."username" NOT LIKE 'mfqst_%'
    ${sqlNotInLower(Prisma.sql`t."email"`, excludedEmails)}
    ${sqlNotInLower(Prisma.sql`t."username"`, excludedUsernames)}
    ${sqlNotInExact(Prisma.sql`t."phone"`, excludedPhones)}
  `;
}

/**
 * SQL fragment: row is a real member for homepage marketing counts (clients table alias `c`).
 */
export function homeUserCountClientWhereSql(options: {
  excludeInternalQaSynthetic: boolean;
}): Prisma.Sql {
  const excludedEmails = getHomeUserCountExcludedEmails();
  const excludedUsernames = getHomeUserCountExcludedUsernames();
  const excludedPhones = getHomeUserCountExcludedPhones();

  const synthClause = options.excludeInternalQaSynthetic
    ? Prisma.sql`AND c."internalQaSyntheticPersona" = false`
    : Prisma.empty;

  return Prisma.sql`
    ${synthClause}
    AND LOWER(c."email") NOT LIKE '%@internal.match-fit.invalid'
    AND LOWER(c."email") NOT LIKE '%@demo.matchfit.invalid'
    AND c."username" NOT LIKE 'mfqsc_%'
    ${sqlNotInLower(Prisma.sql`c."email"`, excludedEmails)}
    ${sqlNotInLower(Prisma.sql`c."username"`, excludedUsernames)}
    ${sqlNotInExact(Prisma.sql`c."phone"`, excludedPhones)}
  `;
}
