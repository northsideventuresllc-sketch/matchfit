import { Prisma } from "@/generated/prisma/client";
import { describe, expect, it } from "vitest";
import { isMissingBetaWaitlistColumnError } from "@/lib/ensure-beta-waitlist-schema";

describe("isMissingBetaWaitlistColumnError", () => {
  it("detects Postgres missing-column messages for invitedBetaPool", () => {
    const err = new Error(
      'Invalid `prisma.betaTrainerWaitlistEntry.count()` invocation: The column `beta_trainer_waitlist_entries.invitedBetaPool` does not exist in the current database.',
    );
    expect(isMissingBetaWaitlistColumnError(err)).toBe(true);
  });

  it("detects missing virtualOnlyBetaSlot on trainer_profiles", () => {
    const err = new Error(
      'The column `trainer_profiles.virtualOnlyBetaSlot` does not exist in the current database.',
    );
    expect(isMissingBetaWaitlistColumnError(err)).toBe(true);
  });

  it("detects Prisma P2022", () => {
    const err = new Prisma.PrismaClientKnownRequestError("Column does not exist", {
      code: "P2022",
      clientVersion: "test",
      meta: { column: "beta_trainer_waitlist_entries.invitedBetaPool" },
    });
    expect(isMissingBetaWaitlistColumnError(err)).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isMissingBetaWaitlistColumnError(new Error("connection refused"))).toBe(false);
  });
});
