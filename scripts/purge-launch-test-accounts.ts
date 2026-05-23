/**
 * Deidentifies internal QA / synthetic accounts so launch counters and browse show zero real users.
 *
 * Dry run: `node --env-file=.env npx tsx scripts/purge-launch-test-accounts.ts`
 * Apply:    `node --env-file=.env npx tsx scripts/purge-launch-test-accounts.ts --apply`
 */
import { deidentifyClientAccount, deidentifyTrainerAccount } from "../src/lib/account-deletion";
import {
  INTERNAL_SYNTHETIC_EMAIL_SUFFIX,
  getLaunchExcludeEmails,
} from "../src/lib/launch-account-counts";
import { prisma } from "../src/lib/prisma";

const APPLY = process.argv.includes("--apply");

function buildOr(role: "client" | "trainer") {
  const emails = getLaunchExcludeEmails(role);
  const or = [
    { internalQaSyntheticPersona: true },
    { email: { endsWith: INTERNAL_SYNTHETIC_EMAIL_SUFFIX, mode: "insensitive" as const } },
  ];
  if (emails.length > 0) {
    or.push({ email: { in: emails } });
  }
  return or;
}

async function main() {
  const [trainers, clients] = await Promise.all([
    prisma.trainer.findMany({
      where: { deidentifiedAt: null, OR: buildOr("trainer") },
      select: { id: true, email: true, username: true },
    }),
    prisma.client.findMany({
      where: { deidentifiedAt: null, OR: buildOr("client") },
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
