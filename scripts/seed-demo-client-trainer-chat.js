/**
 * Dev / QA: open an official trainer–client chat and replace thread messages with a realistic back-and-forth
 * (strength-training inquiry → scheduling). Avoids payment-keyword leakage flags used in chat scanning.
 *
 * From repo root (Node 20+ loads .env):
 *   node --env-file=.env scripts/seed-demo-client-trainer-chat.js <clientUsername> [trainerUsername]
 *
 * trainerUsername defaults to coachshitthead22.
 *
 * Client match is case-insensitive username or exact email (same as dev shortcut identifier).
 */
const { PrismaClient, Prisma } = require("@prisma/client");

const DEFAULT_TRAINER = "coachshitthead22";

/** @type {{ authorRole: 'CLIENT' | 'TRAINER'; body: string }[]} */
const DEMO_MESSAGES = [
  {
    authorRole: "CLIENT",
    body: "Hi — I saw your profile and I am trying to get stronger on the big lifts without burning out. Are you taking new clients right now?",
  },
  {
    authorRole: "TRAINER",
    body: "Hey, thanks for reaching out. Yes, I have a couple of openings. What days and times usually work best for you?",
  },
  {
    authorRole: "CLIENT",
    body: "Mostly weekday evenings after 6, or Saturday mornings if you ever do those.",
  },
  {
    authorRole: "TRAINER",
    body: "Perfect — I have Tue/Thu evenings and Saturday AM. Any injuries or movements that bother you today?",
  },
  {
    authorRole: "CLIENT",
    body: "Nothing serious — just tight shoulders sometimes from desk work. I have been lifting on my own for about a year.",
  },
  {
    authorRole: "TRAINER",
    body: "Got it. We will keep pressing volume sensible and add a little mobility up front. Want to start with one session this week so I can see your technique and goals?",
  },
  {
    authorRole: "CLIENT",
    body: "Yes, that sounds great. I am free Thursday evening if you have something open.",
  },
  {
    authorRole: "TRAINER",
    body: "Thursday works. I will hold a slot — we can confirm length (45 vs 60) when you book through my services on Match Fit so everything stays on-platform.",
  },
];

/** SQLite: Prisma `mode: insensitive` is not available — match case-insensitively in SQL. */
async function resolveClient(prisma, hint) {
  const h = hint.trim();
  if (!h) return null;
  const rows = await prisma.$queryRaw(
    Prisma.sql`SELECT id, username, email FROM clients WHERE lower(username) = lower(${h}) OR lower(email) = lower(${h}) LIMIT 1`,
  );
  const row = rows[0];
  return row ? { id: row.id, username: row.username, email: row.email } : null;
}

async function resolveTrainer(prisma, username) {
  const u = username.trim();
  if (!u) return null;
  const rows = await prisma.$queryRaw(
    Prisma.sql`SELECT id, username FROM trainers WHERE lower(username) = lower(${u}) LIMIT 1`,
  );
  const row = rows[0];
  return row ? { id: row.id, username: row.username } : null;
}

async function main() {
  const clientHint = (process.argv[2] || process.env.MATCH_FIT_DEV_CLIENT_IDENTIFIER || "").trim();
  const trainerUsername = (process.argv[3] || DEFAULT_TRAINER).trim();

  if (!clientHint) {
    console.error(
      "Pass client username or email (or set MATCH_FIT_DEV_CLIENT_IDENTIFIER).\n" +
        "Usage: node --env-file=.env scripts/seed-demo-client-trainer-chat.js <clientUsername> [trainerUsername]",
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const client = await resolveClient(prisma, clientHint);
    if (!client) {
      console.error(`No client found for: ${clientHint}`);
      process.exit(2);
    }

    const trainer = await resolveTrainer(prisma, trainerUsername);
    if (!trainer) {
      console.error(`No trainer found for username: ${trainerUsername}`);
      process.exit(3);
    }

    const officialChatStartedAt = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const baseMsg = Date.now() - DEMO_MESSAGES.length * 5 * 60 * 1000;

    const conv = await prisma.$transaction(async (tx) => {
      const c = await tx.trainerClientConversation.upsert({
        where: { trainerId_clientId: { trainerId: trainer.id, clientId: client.id } },
        create: {
          trainerId: trainer.id,
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

      await tx.chatAdminReviewItem.deleteMany({ where: { conversationId: c.id } });
      await tx.trainerClientChatMessage.deleteMany({ where: { conversationId: c.id } });

      let t = baseMsg;
      for (const m of DEMO_MESSAGES) {
        t += 3 * 60 * 1000 + Math.floor(Math.random() * 90 * 1000);
        await tx.trainerClientChatMessage.create({
          data: {
            conversationId: c.id,
            authorRole: m.authorRole,
            body: m.body,
            createdAt: new Date(t),
          },
        });
      }

      await tx.trainerClientConversation.update({
        where: { id: c.id },
        data: { updatedAt: new Date() },
      });

      return c;
    });

    console.log("Seeded demo chat.");
    console.log(`  Client:   @${client.username} (${client.email})`);
    console.log(`  Trainer:  @${trainer.username}`);
    console.log(`  Conv id:  ${conv.id}`);
    console.log(`  Messages: ${DEMO_MESSAGES.length}`);
    console.log("");
    console.log("Client UI: /client/messages/" + encodeURIComponent(trainer.username));
    console.log("Trainer UI: /trainer/dashboard/messages/" + encodeURIComponent(client.username));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
