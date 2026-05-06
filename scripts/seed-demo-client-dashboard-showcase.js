/**
 * Dev / QA: create five fully-compliant Premium trainers in the client's regional ZIP prefix,
 * materialize today's FeaturedDailyAllocation rows (same rules as production resolver output),
 * and open three official chats so the client dashboard "Recent matches" strip is populated.
 *
 * Requires explicit consent:
 *   MATCH_FIT_SEED_DEMO=1 node --env-file=.env scripts/seed-demo-client-dashboard-showcase.js <clientUsername>
 *
 * Uses stable usernames `mf_demo_feat_<3digitPrefix>_<1-5>` so re-runs update the same coaches.
 */
const { PrismaClient, Prisma } = require("@prisma/client");
const bcrypt = require("bcryptjs");

function homepageDisplayDayKey(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function zipPrefix(zip) {
  if (!zip || typeof zip !== "string") return null;
  const z = zip.replace(/\D/g, "");
  return z.length >= 3 ? z.slice(0, 3) : null;
}

async function resolveClient(prisma, hint) {
  const h = hint.trim();
  if (!h) return null;
  const rows = await prisma.$queryRaw(
    Prisma.sql`SELECT id, username, email, zipCode FROM clients WHERE lower(username) = lower(${h}) OR lower(email) = lower(${h}) LIMIT 1`,
  );
  const row = rows[0];
  return row ? { id: row.id, username: row.username, email: row.email, zipCode: row.zipCode } : null;
}

const DEMO_PASSWORD_HASH = bcrypt.hashSync("DemoSeedCoach!", 10);

const matchAnswers = (inPersonZip) =>
  JSON.stringify({
    offersInPerson: true,
    inPersonZip: String(inPersonZip).replace(/\D/g, "").slice(0, 5) || "10001",
  });

async function ensureFeaturedTrainer(prisma, { index, prefix, inPersonZip }) {
  const username = `mf_demo_feat_${prefix}_${index}`;
  const email = `${username}@demo.matchfit.invalid`;

  const existing = await prisma.trainer.findUnique({
    where: { username },
    select: { id: true },
  });

  const profileData = {
    hasSignedTOS: true,
    hasUploadedW9: true,
    backgroundCheckStatus: "APPROVED",
    backgroundCheckClearedAt: new Date(),
    dashboardActivatedAt: new Date(),
    premiumStudioEnabledAt: new Date(),
    matchQuestionnaireStatus: "completed",
    matchQuestionnaireAnswers: matchAnswers(inPersonZip),
    matchQuestionnaireCompletedAt: new Date(),
    aiMatchProfileText: `Demo featured coach ${index} for ZIP prefix ${prefix}. Strength, conditioning, and accountability.`,
  };

  if (existing) {
    await prisma.trainerProfile.update({
      where: { trainerId: existing.id },
      data: profileData,
    });
    await prisma.trainer.update({
      where: { id: existing.id },
      data: {
        preferredName: `Featured Demo Coach ${index}`,
        fitnessNiches: "Personal Training · Strength",
        bio: `Regional featured demo coach #${index} for prefix ${prefix}.`,
      },
    });
    return existing.id;
  }

  const created = await prisma.trainer.create({
    data: {
      firstName: "Featured",
      lastName: `Demo${index}`,
      username,
      phone: `+1555100${String(3000 + index).slice(-4)}`,
      email,
      passwordHash: DEMO_PASSWORD_HASH,
      termsAcceptedAt: new Date(),
      privacyPolicyAcceptedAt: new Date(),
      preferredName: `Featured Demo Coach ${index}`,
      fitnessNiches: "Personal Training · Strength",
      bio: `Regional featured demo coach #${index} for prefix ${prefix}.`,
      profile: {
        create: profileData,
      },
    },
    select: { id: true },
  });
  return created.id;
}

async function main() {
  if (process.env.MATCH_FIT_SEED_DEMO !== "1") {
    console.error(
      "Refusing to run without MATCH_FIT_SEED_DEMO=1 (protects non-dev databases).\n" +
        "Usage: MATCH_FIT_SEED_DEMO=1 node --env-file=.env scripts/seed-demo-client-dashboard-showcase.js <clientUsername>",
    );
    process.exit(1);
  }

  const clientHint = (process.argv[2] || "").trim();
  if (!clientHint) {
    console.error("Pass client username or email.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const client = await resolveClient(prisma, clientHint);
    if (!client) {
      console.error(`No client found for: ${clientHint}`);
      process.exit(2);
    }

    const prefix = zipPrefix(client.zipCode);
    if (!prefix) {
      console.error(`Client @${client.username} needs a ZIP with at least 3 digits (got: ${client.zipCode})`);
      process.exit(3);
    }

    const digits = String(client.zipCode).replace(/\D/g, "");
    const inPersonZip = (digits + "00000").slice(0, 5);

    const displayDayKey = homepageDisplayDayKey();

    const trainerIds = [];
    for (let i = 1; i <= 5; i++) {
      const id = await ensureFeaturedTrainer(prisma, { index: i, prefix, inPersonZip });
      trainerIds.push(id);
    }

    await prisma.$transaction(async (tx) => {
      await tx.featuredDailyAllocation.deleteMany({
        where: { regionZipPrefix: prefix, displayDayKey },
      });

      let sortOrder = 0;
      for (let i = 0; i < 2; i++) {
        await tx.featuredDailyAllocation.create({
          data: {
            regionZipPrefix: prefix,
            displayDayKey,
            trainerId: trainerIds[i],
            source: "PAID_BID",
            sortOrder: sortOrder++,
          },
        });
      }
      for (let i = 2; i < 5; i++) {
        await tx.featuredDailyAllocation.create({
          data: {
            regionZipPrefix: prefix,
            displayDayKey,
            trainerId: trainerIds[i],
            source: "RAFFLE",
            sortOrder: sortOrder++,
          },
        });
      }
    });

    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      const trainerId = trainerIds[i];
      const officialChatStartedAt = new Date(now - (i + 1) * 60 * 60 * 1000);
      await prisma.trainerClientConversation.upsert({
        where: { trainerId_clientId: { trainerId, clientId: client.id } },
        create: {
          trainerId,
          clientId: client.id,
          officialChatStartedAt,
          relationshipStage: "LEAD",
        },
        update: {
          officialChatStartedAt,
          relationshipStage: "LEAD",
          updatedAt: new Date(),
        },
      });
    }

    console.log("Seeded demo featured coaches + recent matches.");
    console.log(`  Client:        @${client.username}`);
    console.log(`  ZIP prefix:    ${prefix} (display day ${displayDayKey})`);
    console.log(`  Trainers:      mf_demo_feat_${prefix}_1 … _5`);
    console.log(`  Dashboard:     /client/dashboard`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(99);
});
