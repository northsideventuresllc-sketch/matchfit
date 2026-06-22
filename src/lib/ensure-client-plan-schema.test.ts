import { Prisma } from "@/generated/prisma/client";
import { describe, expect, it } from "vitest";
import { isMissingClientPlanColumnError } from "@/lib/ensure-client-plan-schema";

describe("isMissingClientPlanColumnError", () => {
  it("detects Postgres missing-column messages", () => {
    const err = new Error(
      'Invalid `prisma.client.count()` invocation: The column `clients.vipSubscriptionActive` does not exist in the current database.',
    );
    expect(isMissingClientPlanColumnError(err)).toBe(true);
  });

  it("detects Prisma P2022", () => {
    const err = new Prisma.PrismaClientKnownRequestError("Column does not exist", {
      code: "P2022",
      clientVersion: "test",
      meta: { column: "clients.clientPlanTier" },
    });
    expect(isMissingClientPlanColumnError(err)).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isMissingClientPlanColumnError(new Error("connection refused"))).toBe(false);
  });
});
