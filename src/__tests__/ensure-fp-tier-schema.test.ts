import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { isMissingFpTierColumnError } from "@/lib/ensure-fp-tier-schema";

describe("ensure-fp-tier-schema", () => {
  it("detects Prisma P2022 for accountTier", () => {
    const error = new Prisma.PrismaClientKnownRequestError("column accountTier does not exist", {
      code: "P2022",
      clientVersion: "test",
      meta: { column: "trainer_profiles.accountTier" },
    });
    expect(isMissingFpTierColumnError(error)).toBe(true);
  });

  it("detects nudgeCreditsBalance in error message", () => {
    expect(
      isMissingFpTierColumnError(new Error('column "nudgeCreditsBalance" does not exist (P2022)')),
    ).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isMissingFpTierColumnError(new Error("connection refused"))).toBe(false);
  });
});
