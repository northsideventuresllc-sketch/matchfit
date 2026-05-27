/**
 * Prints real vs excluded launch account rows (founding promo counters use the same filters).
 *
 * Usage: `node --env-file=.env npx tsx scripts/audit-launch-accounts.ts`
 */
import {
  launchClientCountWhere,
  launchTrainerCountWhere,
} from "../src/lib/launch-account-counts";
import { getLaunchPromoStats } from "../src/lib/launch-promo-stats";
import { prisma } from "../src/lib/prisma";

async function main() {
  const stats = await getLaunchPromoStats();

  const [realClients, realTrainers, allClients, allTrainers] = await Promise.all([
    prisma.client.findMany({
      where: launchClientCountWhere(),
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        stripeSubscriptionId: true,
        stripeSubscriptionActive: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.trainer.findMany({
      where: launchTrainerCountWhere(),
      select: { id: true, username: true, email: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.client.count({ where: { deidentifiedAt: null } }),
    prisma.trainer.count({ where: { deidentifiedAt: null } }),
  ]);

  console.log("=== Launch promo stats (production counters) ===");
  console.log(JSON.stringify(stats, null, 2));
  console.log("");
  console.log(`DB rows (not deidentified): ${allClients} clients, ${allTrainers} trainers`);
  console.log(`Counted for founding promos: ${stats.clientCount} clients, ${stats.trainerCount} trainers`);
  console.log("");

  console.log("--- Real clients (founding promo count) ---");
  if (realClients.length === 0) {
    console.log("(none)");
  } else {
    for (const c of realClients) {
      const sub = c.stripeSubscriptionId?.trim() ? "has subscription" : "no subscription id yet";
      console.log(
        `  ${c.username} <${c.email}> created=${c.createdAt.toISOString()} active=${c.stripeSubscriptionActive} ${sub}`,
      );
    }
  }

  console.log("\n--- Real trainers (founding promo count) ---");
  if (realTrainers.length === 0) {
    console.log("(none)");
  } else {
    for (const t of realTrainers) {
      console.log(`  ${t.username} <${t.email}> created=${t.createdAt.toISOString()}`);
    }
  }
}

void main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
