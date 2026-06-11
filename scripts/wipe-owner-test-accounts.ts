/**
 * Permanently remove owner dev/QA portals from the platform (deidentify + delete pipeline crumbs).
 *
 * Dry run: `node --env-file=.env npx tsx scripts/wipe-owner-test-accounts.ts`
 * Apply:    `node --env-file=.env npx tsx scripts/wipe-owner-test-accounts.ts --apply`
 */
import {
  deidentifyClientAccountWithDb,
  deidentifyTrainerAccountWithDb,
} from "../src/lib/account-deidentify-core";
import {
  MATCH_FIT_EXCLUDE_NON_PRODUCTION_CLIENT_USERNAMES,
  MATCH_FIT_EXCLUDE_NON_PRODUCTION_MEMBER_EMAILS,
  MATCH_FIT_EXCLUDE_NON_PRODUCTION_TRAINER_USERNAMES,
} from "../src/lib/match-fit-production-member-excludes";
import { createPrismaClient } from "./create-prisma-client.mjs";

const APPLY = process.argv.includes("--apply");
const prisma = createPrismaClient();

function usernameEqualsOr(usernames: readonly string[]) {
  return usernames.map((username) => ({ username: { equals: username, mode: "insensitive" as const } }));
}

function emailEqualsOr(emails: readonly string[]) {
  return emails.map((email) => ({ email: { equals: email, mode: "insensitive" as const } }));
}

async function main() {
  const clientUsernames = [...MATCH_FIT_EXCLUDE_NON_PRODUCTION_CLIENT_USERNAMES];
  const trainerUsernames = [...MATCH_FIT_EXCLUDE_NON_PRODUCTION_TRAINER_USERNAMES];
  const emails = [...MATCH_FIT_EXCLUDE_NON_PRODUCTION_MEMBER_EMAILS];
  const allUsernames = [...new Set([...clientUsernames, ...trainerUsernames])];

  const [clients, trainers, signupProgress, pendingRegs] = await Promise.all([
    prisma.client.findMany({
      where: {
        deidentifiedAt: null,
        OR: [...usernameEqualsOr(clientUsernames), ...emailEqualsOr(emails)],
      },
      select: { id: true, username: true, email: true },
    }),
    prisma.trainer.findMany({
      where: {
        deidentifiedAt: null,
        OR: [...usernameEqualsOr(trainerUsernames), ...emailEqualsOr(emails)],
      },
      select: { id: true, username: true, email: true },
    }),
    prisma.signupFormProgress.findMany({
      where: {
        OR: [...usernameEqualsOr(allUsernames), ...emailEqualsOr(emails)],
      },
      select: { id: true, role: true, username: true, email: true, stage: true },
    }),
    prisma.pendingClientRegistration.findMany({
      where: {
        OR: [...usernameEqualsOr(allUsernames), ...emailEqualsOr(emails)],
      },
      select: { id: true, username: true, email: true, status: true },
    }),
  ]);

  console.log("Owner test account wipe preview:");
  console.log(`  clients to deidentify: ${clients.length}`);
  for (const c of clients) console.log(`    client ${c.username} <${c.email}>`);
  console.log(`  trainers to deidentify: ${trainers.length}`);
  for (const t of trainers) console.log(`    trainer ${t.username} <${t.email}>`);
  console.log(`  signup progress rows to delete: ${signupProgress.length}`);
  for (const row of signupProgress) {
    console.log(`    ${row.role} ${row.username ?? "—"} <${row.email ?? "—"}> (${row.stage})`);
  }
  console.log(`  pending registrations to delete: ${pendingRegs.length}`);
  for (const row of pendingRegs) console.log(`    ${row.username} <${row.email}> (${row.status})`);

  if (!APPLY) {
    console.log("\nDry run only. Re-run with --apply to wipe these accounts.");
    return;
  }

  if (signupProgress.length > 0) {
    await prisma.signupFormProgress.deleteMany({
      where: { id: { in: signupProgress.map((row) => row.id) } },
    });
  }

  if (pendingRegs.length > 0) {
    await prisma.pendingClientRegistration.deleteMany({
      where: { id: { in: pendingRegs.map((row) => row.id) } },
    });
  }

  for (const t of trainers) {
    await deidentifyTrainerAccountWithDb(prisma, t.id);
    console.log(`Deidentified trainer ${t.username}`);
  }

  for (const c of clients) {
    await deidentifyClientAccountWithDb(prisma, c.id);
    console.log(`Deidentified client ${c.username}`);
  }

  console.log("\nOwner test account wipe complete.");
}

void main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
