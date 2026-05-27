/**
 * Resets owner portal passwords and removes the login-2FA integration test client.
 *
 *   MATCH_FIT_OWNER_PORTAL_PASSWORD='…' node --env-file=.env npx tsx scripts/reset-owner-portal-passwords.ts
 *
 * Targets:
 *   - Client jbfitness6299
 *   - Trainer coachjonny22
 *   - Administrator jobo0602 (upsert if missing)
 *   - Deidentifies twofa_tester (integration-test fixture)
 */
import bcrypt from "bcryptjs";
import { deidentifyClientAccount } from "../src/lib/account-deletion";
import { createPrismaClient } from "./create-prisma-client.mjs";

const CLIENT_USERNAME = "jbfitness6299";
const TRAINER_USERNAME = "coachjonny22";
const ADMIN_CODE = "jobo0602";
const ADMIN_EMAIL = "jb@match-fit.net";
const TWOFA_TEST_USERNAME = "twofa_tester";

async function main() {
  const password = process.env.MATCH_FIT_OWNER_PORTAL_PASSWORD?.trim();
  if (!password || password.length < 8) {
    console.error("Set MATCH_FIT_OWNER_PORTAL_PASSWORD (8+ characters) before running.");
    process.exit(1);
  }

  const prisma = createPrismaClient();
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const client = await prisma.client.findFirst({
      where: { username: CLIENT_USERNAME, deidentifiedAt: null },
      select: { id: true, email: true },
    });
    if (!client) {
      console.error(`Active client not found: ${CLIENT_USERNAME}`);
      process.exit(1);
    }
    await prisma.client.update({
      where: { id: client.id },
      data: {
        passwordHash,
        twoFactorEnabled: false,
        twoFactorMethod: "NONE",
        twoFactorOtpHash: null,
        twoFactorOtpExpires: null,
        twoFactorLoginAttempts: 0,
      },
    });
    await prisma.clientTwoFactorChannel.deleteMany({ where: { clientId: client.id } });
    console.log(`Updated client password: ${CLIENT_USERNAME} <${client.email}>`);

    const trainer = await prisma.trainer.findFirst({
      where: { username: TRAINER_USERNAME, deidentifiedAt: null },
      select: { id: true, email: true },
    });
    if (!trainer) {
      console.error(`Active trainer not found: ${TRAINER_USERNAME}`);
      process.exit(1);
    }
    await prisma.trainer.update({
      where: { id: trainer.id },
      data: {
        passwordHash,
        twoFactorEnabled: false,
        twoFactorMethod: "NONE",
        twoFactorOtpHash: null,
        twoFactorOtpExpires: null,
        twoFactorLoginAttempts: 0,
      },
    });
    await prisma.trainerTwoFactorChannel.deleteMany({ where: { trainerId: trainer.id } });
    console.log(`Updated trainer password: ${TRAINER_USERNAME} <${trainer.email}>`);

    await prisma.administrator.upsert({
      where: { adminCode: ADMIN_CODE },
      create: {
        adminCode: ADMIN_CODE,
        email: ADMIN_EMAIL,
        passwordHash,
        firstName: "Jonny",
        lastName: "Booth",
        dateOfBirth: "1990-06-02",
      },
      update: {
        email: ADMIN_EMAIL,
        passwordHash,
        firstName: "Jonny",
        lastName: "Booth",
        dateOfBirth: "1990-06-02",
      },
    });
    console.log(`Upserted administrator: ${ADMIN_CODE} (${ADMIN_EMAIL})`);

    const twofa = await prisma.client.findFirst({
      where: { username: TWOFA_TEST_USERNAME, deidentifiedAt: null },
      select: { id: true, email: true },
    });
    if (twofa) {
      await deidentifyClientAccount(twofa.id);
      console.log(`Deidentified 2FA test client: ${TWOFA_TEST_USERNAME} <${twofa.email}>`);
    } else {
      console.log(`2FA test client not found (already removed): ${TWOFA_TEST_USERNAME}`);
    }

    console.log("\nDone. Sign in with the new password on each portal.");
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
