/**
 * Demo trainer for FP account tier UI screenshots / local QA.
 *
 *   DATABASE_URL=... node scripts/seed-fp-tier-demo.js
 */
const bcrypt = require("bcryptjs");

async function main() {
  const { createPrismaClient } = await import("./create-prisma-client.mjs");
  const prisma = createPrismaClient();
  const email = "fp-tier-demo@matchfit.test";
  const passwordHash = await bcrypt.hash("FpTierDemo123!", 12);
  const now = new Date();

  let trainer = await prisma.trainer.findUnique({ where: { email } });
  if (!trainer) {
    trainer = await prisma.trainer.create({
      data: {
        firstName: "Demo",
        lastName: "Pro",
        username: "fptierdemo",
        phone: "4045550100",
        email,
        passwordHash,
        stayLoggedIn: true,
        termsAcceptedAt: now,
        eliteDashboardViewMode: "independent_fitness_pro",
        profile: {
          create: {
            hasSignedTOS: true,
            accountTier: "elite_fitness_pro",
            listingStatus: "active",
            docsSubmitted: true,
            docsApproved: true,
            limitedDashboardUnlockedAt: now,
            dashboardActivatedAt: now,
            registrationFeeHoldStatus: "HELD",
            backgroundCheckPassed: true,
            backgroundCheckStatus: "APPROVED",
            promoteTokensBalance: 12,
          },
        },
      },
    });
  } else {
    await prisma.trainer.update({
      where: { id: trainer.id },
      data: { passwordHash, eliteDashboardViewMode: "independent_fitness_pro" },
    });
    await prisma.trainerProfile.update({
      where: { trainerId: trainer.id },
      data: {
        hasSignedTOS: true,
        accountTier: "elite_fitness_pro",
        listingStatus: "active",
        docsSubmitted: true,
        docsApproved: true,
        limitedDashboardUnlockedAt: now,
        dashboardActivatedAt: now,
        registrationFeeHoldStatus: "HELD",
        backgroundCheckPassed: true,
        promoteTokensBalance: 12,
      },
    });
  }

  await prisma.fpListingStats.upsert({
    where: { trainerId: trainer.id },
    create: {
      trainerId: trainer.id,
      profileViews: 128,
      clickThroughs: 42,
      reviewCountInternal: 7,
      reviewCountExternal: 3,
      activeListingsCount: 2,
    },
    update: {
      profileViews: 128,
      clickThroughs: 42,
      reviewCountInternal: 7,
      reviewCountExternal: 3,
      activeListingsCount: 2,
    },
  });

  const historyCount = await prisma.tierSwitchHistory.count({ where: { trainerId: trainer.id } });
  if (historyCount === 0) {
    await prisma.tierSwitchHistory.create({
      data: {
        trainerId: trainer.id,
        fromTier: "match_fit_pro",
        toTier: "elite_fitness_pro",
        initiatedBy: "trainer",
      },
    });
  }

  console.log(`Demo trainer ready: ${email} / FpTierDemo123! (username: ${trainer.username})`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
