/**
 * Deidentifies internal QA / synthetic accounts so launch counters and browse show zero real users.
 *
 * Targets synthetic rows and built-in owner QA accounts (see match-fit-launch-exclude-accounts.ts).
 * Use --apply only on production when you intend to deidentify those rows.
 *
 * Dry run: `node --env-file=.env npx tsx scripts/purge-launch-test-accounts.ts`
 * Apply:    `node --env-file=.env npx tsx scripts/purge-launch-test-accounts.ts --apply`
 */
import { deidentifyClientAccount, deidentifyTrainerAccount } from "../src/lib/account-deletion";
import {
  getMatchFitLaunchExcludeClientUsernames,
  getMatchFitLaunchExcludeEmails,
  getMatchFitLaunchExcludeTrainerUsernames,
  MATCH_FIT_INTEGRATION_TEST_EMAIL_SUFFIX,
} from "../src/lib/match-fit-launch-exclude-accounts";
import {
  INTERNAL_SYNTHETIC_EMAIL_SUFFIX,
  SYNTHETIC_CLIENT_USERNAME_PREFIX,
  SYNTHETIC_TRAINER_USERNAME_PREFIX,
} from "../src/lib/launch-account-counts";
import { prisma } from "../src/lib/prisma";

const APPLY = process.argv.includes("--apply");

function syntheticTrainerWhere() {
  const excludeEmails = getMatchFitLaunchExcludeEmails();
  const excludeUsernames = getMatchFitLaunchExcludeTrainerUsernames();
  return {
    deidentifiedAt: null,
    OR: [
      { internalQaSyntheticPersona: true },
      { email: { endsWith: INTERNAL_SYNTHETIC_EMAIL_SUFFIX, mode: "insensitive" as const } },
      { email: { endsWith: ".invalid", mode: "insensitive" as const } },
      { email: { endsWith: MATCH_FIT_INTEGRATION_TEST_EMAIL_SUFFIX, mode: "insensitive" as const } },
      ...(excludeEmails.length > 0
        ? [{ email: { in: excludeEmails, mode: "insensitive" as const } }]
        : []),
      { username: { startsWith: SYNTHETIC_TRAINER_USERNAME_PREFIX, mode: "insensitive" as const } },
      ...excludeUsernames.map((u) => ({
        username: { equals: u, mode: "insensitive" as const },
      })),
    ],
  };
}

function syntheticClientWhere() {
  const excludeEmails = getMatchFitLaunchExcludeEmails();
  const excludeUsernames = getMatchFitLaunchExcludeClientUsernames();
  return {
    deidentifiedAt: null,
    OR: [
      { internalQaSyntheticPersona: true },
      { email: { endsWith: INTERNAL_SYNTHETIC_EMAIL_SUFFIX, mode: "insensitive" as const } },
      { email: { endsWith: ".invalid", mode: "insensitive" as const } },
      { email: { endsWith: MATCH_FIT_INTEGRATION_TEST_EMAIL_SUFFIX, mode: "insensitive" as const } },
      ...(excludeEmails.length > 0
        ? [{ email: { in: excludeEmails, mode: "insensitive" as const } }]
        : []),
      { username: { startsWith: SYNTHETIC_CLIENT_USERNAME_PREFIX, mode: "insensitive" as const } },
      ...excludeUsernames.map((u) => ({
        username: { equals: u, mode: "insensitive" as const },
      })),
    ],
  };
}

async function main() {
  const [trainers, clients] = await Promise.all([
    prisma.trainer.findMany({
      where: syntheticTrainerWhere(),
      select: { id: true, email: true, username: true },
    }),
    prisma.client.findMany({
      where: syntheticClientWhere(),
      select: { id: true, email: true, username: true },
    }),
  ]);

  console.log(`Found ${trainers.length} trainer(s) and ${clients.length} client(s) to deidentify.`);
  for (const t of trainers) console.log(`  trainer ${t.username} <${t.email}>`);
  for (const c of clients) console.log(`  client ${c.username} <${c.email}>`);

  if (!APPLY) {
    console.log("\nDry run only. Re-run with --apply to deidentify these accounts.");
    return;
  }

  for (const t of trainers) {
    await deidentifyTrainerAccount(t.id);
  }
  for (const c of clients) {
    await deidentifyClientAccount(c.id);
  }

  await prisma.trainer.updateMany({
    where: {
      deidentifiedAt: null,
      OR: [
        { email: { endsWith: INTERNAL_SYNTHETIC_EMAIL_SUFFIX, mode: "insensitive" } },
        { internalQaSyntheticPersona: true },
        { username: { startsWith: SYNTHETIC_TRAINER_USERNAME_PREFIX, mode: "insensitive" } },
      ],
    },
    data: { internalQaSyntheticPersona: true },
  });
  await prisma.client.updateMany({
    where: {
      deidentifiedAt: null,
      OR: [
        { email: { endsWith: INTERNAL_SYNTHETIC_EMAIL_SUFFIX, mode: "insensitive" } },
        { internalQaSyntheticPersona: true },
        { username: { startsWith: SYNTHETIC_CLIENT_USERNAME_PREFIX, mode: "insensitive" } },
      ],
    },
    data: { internalQaSyntheticPersona: true },
  });

  console.log("\nDeidentification complete.");
}

void main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
