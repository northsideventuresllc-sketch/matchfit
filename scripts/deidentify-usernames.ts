/**
 * Deidentify client and/or trainer rows by username (case-insensitive).
 *
 * Dry run:  `node --env-file=.env npx tsx scripts/deidentify-usernames.ts jibbyjam22`
 * Apply:    `node --env-file=.env npx tsx scripts/deidentify-usernames.ts jibbyjam22 --apply`
 */
import {
  deidentifyClientAccountWithDb,
  deidentifyTrainerAccountWithDb,
} from "../src/lib/account-deidentify-core";
import { createPrismaClient } from "./create-prisma-client.mjs";

const APPLY = process.argv.includes("--apply");
const usernames = process.argv
  .slice(2)
  .filter((arg) => arg !== "--apply")
  .map((u) => u.trim().replace(/^@/, "").toLowerCase())
  .filter(Boolean);

const prisma = createPrismaClient();

async function main() {
  if (usernames.length === 0) {
    console.error("Usage: npx tsx scripts/deidentify-usernames.ts <username> [username…] [--apply]");
    process.exit(1);
  }

  const [clients, trainers] = await Promise.all([
    prisma.client.findMany({
      where: {
        deidentifiedAt: null,
        OR: usernames.map((username) => ({ username: { equals: username, mode: "insensitive" as const } })),
      },
      select: { id: true, username: true, email: true },
    }),
    prisma.trainer.findMany({
      where: {
        deidentifiedAt: null,
        OR: usernames.map((username) => ({ username: { equals: username, mode: "insensitive" as const } })),
      },
      select: { id: true, username: true, email: true },
    }),
  ]);

  console.log(`Usernames: ${usernames.join(", ")}`);
  console.log(`Found ${clients.length} client(s) and ${trainers.length} trainer(s) to deidentify.`);
  for (const c of clients) console.log(`  client ${c.username} <${c.email}>`);
  for (const t of trainers) console.log(`  trainer ${t.username} <${t.email}>`);

  if (!APPLY) {
    console.log("\nDry run only. Re-run with --apply to deidentify these accounts.");
    return;
  }

  for (const t of trainers) {
    await deidentifyTrainerAccountWithDb(prisma, t.id);
    console.log(`Deidentified trainer ${t.username}`);
  }
  for (const c of clients) {
    await deidentifyClientAccountWithDb(prisma, c.id);
    console.log(`Deidentified client ${c.username}`);
  }

  const signupDeleted = await prisma.signupFormProgress.deleteMany({
    where: {
      OR: usernames.flatMap((username) => [
        { username: { equals: username, mode: "insensitive" as const } },
        { email: { contains: username, mode: "insensitive" as const } },
      ]),
    },
  });
  const pendingDeleted = await prisma.pendingClientRegistration.deleteMany({
    where: {
      OR: usernames.map((username) => ({ username: { equals: username, mode: "insensitive" as const } })),
    },
  });

  console.log(`Deleted ${signupDeleted.count} signup progress row(s) and ${pendingDeleted.count} pending registration(s).`);
  console.log("\nDeidentification complete.");
}

void main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
