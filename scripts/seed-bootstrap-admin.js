/**
 * Creates or updates the bootstrap Match Fit administrator account `jobo0602`.
 *
 * Usage:
 *   MATCH_FIT_BOOTSTRAP_ADMIN_PASSWORD='your-secure-password' node --env-file=.env scripts/seed-bootstrap-admin.js
 *
 * Requires: prisma migrate applied (administrator tables), bcryptjs, @prisma/client.
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const password = process.env.MATCH_FIT_BOOTSTRAP_ADMIN_PASSWORD?.trim();
  if (!password || password.length < 12) {
    console.error("Set MATCH_FIT_BOOTSTRAP_ADMIN_PASSWORD (12+ characters) before running this script.");
    process.exit(1);
  }

  const adminCode = "jobo0602";
  const email = "northside.ventures.llc@gmail.com";
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.administrator.upsert({
    where: { adminCode },
    create: {
      adminCode,
      email,
      passwordHash,
      firstName: "Jonny",
      lastName: "Booth",
      dateOfBirth: "1990-06-02",
    },
    update: {
      email,
      passwordHash,
      firstName: "Jonny",
      lastName: "Booth",
      dateOfBirth: "1990-06-02",
    },
  });

  console.log(`Administrator upserted: ${adminCode} (${email})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
