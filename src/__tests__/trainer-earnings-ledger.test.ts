import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  applyTrainerEarningsDelta,
  creditTrainerEarningsIfNotAlready,
  getTrainerEarningsBalanceCents,
} from "@/lib/trainer-earnings-ledger";

describe.skipIf(!process.env.TEST_DATABASE_URL?.trim())("trainer earnings ledger", () => {
  let trainerId = "";

  beforeAll(() => {
    const env = { ...process.env };
    const allowLoss = env.MATCH_FIT_INTEGRATION_TEST_DB_PUSH_ACCEPT_DATA_LOSS === "1";
    try {
      execSync("npx prisma generate && npx prisma db push", { stdio: "inherit", cwd: process.cwd(), env });
    } catch {
      if (!allowLoss) {
        throw new Error(
          "trainer-earnings-ledger integration: `prisma db push` failed. Point DATABASE_URL at a disposable " +
            "database and set MATCH_FIT_INTEGRATION_TEST_DB_PUSH_ACCEPT_DATA_LOSS=1, or repair migration history.",
        );
      }
      execSync("npx prisma generate && npx prisma db push --accept-data-loss", {
        stdio: "inherit",
        cwd: process.cwd(),
        env,
      });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.trainerEarningsLedgerEntry.deleteMany({});
    await prisma.trainerEarningsBalance.deleteMany({});
    await prisma.trainer.deleteMany({ where: { username: "earnings_ledger_tester" } });
    const trainer = await prisma.trainer.create({
      data: {
        username: "earnings_ledger_tester",
        email: "earnings_ledger_tester@example.test",
        firstName: "Ledger",
        lastName: "Tester",
        phone: "5555550100",
        passwordHash: "x",
      },
    });
    trainerId = trainer.id;
  });

  it("credits a balance and writes an audit entry", async () => {
    await prisma.$transaction(async (tx) => {
      await applyTrainerEarningsDelta(tx, trainerId, 2500, "SESSION_PAYOUT_CLEARED", "session:1");
    });
    expect(await getTrainerEarningsBalanceCents(trainerId)).toBe(2500);
    const entry = await prisma.trainerEarningsLedgerEntry.findFirst({ where: { trainerId } });
    expect(entry).toMatchObject({ deltaCents: 2500, reason: "SESSION_PAYOUT_CLEARED", referenceKey: "session:1" });
  });

  it("never lets a debit take the balance negative", async () => {
    await prisma.$transaction(async (tx) => {
      await applyTrainerEarningsDelta(tx, trainerId, 1000, "SESSION_PAYOUT_CLEARED", "session:2");
    });
    await expect(
      prisma.$transaction(async (tx) => {
        await applyTrainerEarningsDelta(tx, trainerId, -1500, "PAYOUT_WITHDRAWAL", "payout:1");
      }),
    ).rejects.toThrow("INSUFFICIENT_EARNINGS_BALANCE");
    expect(await getTrainerEarningsBalanceCents(trainerId)).toBe(1000);
  });

  it("skips a duplicate credit for the same reference key instead of double-crediting", async () => {
    const credit = () =>
      prisma.$transaction(async (tx) => {
        await creditTrainerEarningsIfNotAlready(tx, trainerId, 800, "SESSION_PAYOUT_CLEARED", "session:3");
      });
    await credit();
    await credit();
    expect(await getTrainerEarningsBalanceCents(trainerId)).toBe(800);
    const entries = await prisma.trainerEarningsLedgerEntry.findMany({ where: { trainerId } });
    expect(entries).toHaveLength(1);
  });

  it("keeps balances isolated per trainer", async () => {
    const other = await prisma.trainer.create({
      data: {
        username: "earnings_ledger_tester_2",
        email: "earnings_ledger_tester_2@example.test",
        firstName: "Ledger",
        lastName: "Tester2",
        phone: "5555550101",
        passwordHash: "x",
      },
    });
    await prisma.$transaction(async (tx) => {
      await applyTrainerEarningsDelta(tx, trainerId, 500, "SESSION_PAYOUT_CLEARED", "session:4");
      await applyTrainerEarningsDelta(tx, other.id, 900, "SESSION_PAYOUT_CLEARED", "session:5");
    });
    expect(await getTrainerEarningsBalanceCents(trainerId)).toBe(500);
    expect(await getTrainerEarningsBalanceCents(other.id)).toBe(900);
    await prisma.trainer.delete({ where: { id: other.id } });
  });
});
