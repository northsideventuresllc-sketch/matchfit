import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyTrainerEarningsDelta } from "@/lib/trainer-earnings-ledger";
import {
  computeTrainerEarningsForTaxYear,
  IRS_1099_NEC_THRESHOLD_CENTS,
  listTrainerEarningsForTaxYear,
} from "@/lib/trainer-tax-year-earnings";

describe.skipIf(!process.env.TEST_DATABASE_URL?.trim())("trainer tax year earnings", () => {
  let trainerId = "";
  const TAX_YEAR = 2026;

  beforeAll(() => {
    const env = { ...process.env };
    const allowLoss = env.MATCH_FIT_INTEGRATION_TEST_DB_PUSH_ACCEPT_DATA_LOSS === "1";
    try {
      execSync("npx prisma generate && npx prisma db push", { stdio: "inherit", cwd: process.cwd(), env });
    } catch {
      if (!allowLoss) {
        throw new Error(
          "trainer-tax-year-earnings integration: `prisma db push` failed. Point DATABASE_URL at a disposable " +
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
    await prisma.trainer.deleteMany({ where: { username: "tax_year_tester" } });
    const trainer = await prisma.trainer.create({
      data: {
        username: "tax_year_tester",
        email: "tax_year_tester@example.test",
        firstName: "Tax",
        lastName: "Tester",
        phone: "5555550200",
        passwordHash: "x",
      },
    });
    trainerId = trainer.id;
  });

  async function creditAt(deltaCents: number, reason: string, createdAt: Date, referenceKey: string) {
    await prisma.$transaction(async (tx) => {
      await applyTrainerEarningsDelta(tx, trainerId, deltaCents, reason as never, referenceKey);
    });
    await prisma.trainerEarningsLedgerEntry.updateMany({
      where: { trainerId, referenceKey },
      data: { createdAt },
    });
  }

  it("sums only taxable-earning reasons within the calendar year", async () => {
    await creditAt(30_000, "SESSION_PAYOUT_CLEARED", new Date(Date.UTC(TAX_YEAR, 5, 1)), "r1");
    await creditAt(20_000, "SERVICE_SALE_CLEARED", new Date(Date.UTC(TAX_YEAR, 6, 1)), "r2");
    // Out of year — excluded.
    await creditAt(50_000, "SESSION_PAYOUT_CLEARED", new Date(Date.UTC(TAX_YEAR - 1, 11, 31)), "r3");
    // Withdrawal + reversal — not earned income, excluded even though the reversal delta is positive.
    await creditAt(-10_000, "PAYOUT_WITHDRAWAL", new Date(Date.UTC(TAX_YEAR, 7, 1)), "r4");
    await creditAt(10_000, "PAYOUT_REVERSED", new Date(Date.UTC(TAX_YEAR, 7, 1)), "r5");

    const total = await computeTrainerEarningsForTaxYear(trainerId, TAX_YEAR);
    expect(total).toBe(50_000);
  });

  it("flags a trainer over the IRS threshold", async () => {
    await creditAt(IRS_1099_NEC_THRESHOLD_CENTS, "SESSION_PAYOUT_CLEARED", new Date(Date.UTC(TAX_YEAR, 3, 1)), "r1");
    const rows = await listTrainerEarningsForTaxYear(TAX_YEAR);
    const row = rows.find((r) => r.trainerId === trainerId);
    expect(row).toMatchObject({ totalEarnedCents: IRS_1099_NEC_THRESHOLD_CENTS, overThreshold: true });
  });

  it("does not flag a trainer under the threshold", async () => {
    await creditAt(IRS_1099_NEC_THRESHOLD_CENTS - 1, "SESSION_PAYOUT_CLEARED", new Date(Date.UTC(TAX_YEAR, 3, 1)), "r1");
    const rows = await listTrainerEarningsForTaxYear(TAX_YEAR);
    const row = rows.find((r) => r.trainerId === trainerId);
    expect(row).toMatchObject({ overThreshold: false });
  });
});
