/**
 * Marks platform revenue ledger rows from test/sandbox accounts as non-live.
 *
 *   node --env-file=.env scripts/scrub-sandbox-revenue-events.mjs
 */
const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const excludedClients = await prisma.client.findMany({
      where: {
        OR: [
          { stripeBillingLiveMode: false },
          { username: { equals: "jbfitness6299", mode: "insensitive" } },
          { email: { equals: "jonnybooth22@gmail.com", mode: "insensitive" } },
          { internalQaSyntheticPersona: true },
          { email: { endsWith: "@internal.match-fit.invalid", mode: "insensitive" } },
        ],
      },
      select: { id: true, username: true, email: true },
      take: 5000,
    });

    const excludedTrainers = await prisma.trainer.findMany({
      where: {
        OR: [
          { username: { equals: "coachjonny22", mode: "insensitive" } },
          { email: { equals: "jb@northsideventuresgroup.com", mode: "insensitive" } },
          { internalQaSyntheticPersona: true },
          { email: { endsWith: "@internal.match-fit.invalid", mode: "insensitive" } },
        ],
      },
      select: { id: true, username: true, email: true },
      take: 5000,
    });

    const clientIds = excludedClients.map((c) => c.id);
    const trainerIds = excludedTrainers.map((t) => t.id);

    const or = [];
    if (clientIds.length > 0) or.push({ clientId: { in: clientIds } });
    if (trainerIds.length > 0) or.push({ trainerId: { in: trainerIds } });

    if (or.length === 0) {
      console.log("No excluded accounts found; nothing to scrub.");
      return;
    }

    const result = await prisma.platformRevenueEvent.updateMany({
      where: { billingLiveMode: true, OR: or },
      data: { billingLiveMode: false },
    });

    console.log(`Scrubbed ${result.count} platform revenue event(s) from admin metrics.`);
    if (excludedClients.length > 0) {
      console.log("Excluded clients:", excludedClients.map((c) => `@${c.username} (${c.email})`).join(", "));
    }
    if (excludedTrainers.length > 0) {
      console.log("Excluded trainers:", excludedTrainers.map((t) => `@${t.username} (${t.email})`).join(", "));
    }

    const live = await prisma.platformRevenueEvent.aggregate({
      where: { billingLiveMode: true },
      _sum: { revenueCents: true, grossProfitCents: true },
      _count: { _all: true },
    });
    console.log(
      `Remaining live revenue: $${((live._sum.revenueCents ?? 0) / 100).toFixed(2)} collected, $${((live._sum.grossProfitCents ?? 0) / 100).toFixed(2)} profit (${live._count._all} events).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
