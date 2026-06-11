/**
 * Deidentify client and/or trainer rows by username (case-insensitive).
 *
 * Dry run:  `node --env-file=.env npx tsx scripts/deidentify-usernames.ts jibbyjam22`
 * Apply:    `node --env-file=.env npx tsx scripts/deidentify-usernames.ts jibbyjam22 --apply`
 */
import { deidentifyClientAccount, deidentifyTrainerAccount } from "../src/lib/account-deletion";
import { scrubNonLivePlatformRevenueEvents } from "../src/lib/platform-revenue-filters";
import { prisma } from "../src/lib/prisma";

const APPLY = process.argv.includes("--apply");
const usernames = process.argv
  .slice(2)
  .filter((arg) => arg !== "--apply")
  .map((u) => u.trim().replace(/^@/, "").toLowerCase())
  .filter(Boolean);

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
    await deidentifyTrainerAccount(t.id);
    console.log(`Deidentified trainer ${t.username}`);
  }
  for (const c of clients) {
    await deidentifyClientAccount(c.id);
    console.log(`Deidentified client ${c.username}`);
  }

  const scrubbed = await scrubNonLivePlatformRevenueEvents();
  console.log(`Scrubbed ${scrubbed} non-live platform revenue row(s).`);
  console.log("\nDeidentification complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
