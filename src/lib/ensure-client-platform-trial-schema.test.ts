import { Prisma } from "@/generated/prisma/client";
import { describe, expect, it } from "vitest";
import { isMissingClientPlatformTrialColumnError } from "@/lib/ensure-client-platform-trial-schema";

describe("isMissingClientPlatformTrialColumnError", () => {
  it("detects Postgres missing-column messages", () => {
    const err = new Error(
      'Invalid `prisma.client.findFirst()` invocation: The column `clients.accountDeactivatedAt` does not exist in the current database.',
    );
    expect(isMissingClientPlatformTrialColumnError(err)).toBe(true);
  });

  it("detects Prisma P2022", () => {
    const err = new Prisma.PrismaClientKnownRequestError("Column does not exist", {
      code: "P2022",
      clientVersion: "test",
      meta: { column: "clients.platformTrialEndsAt" },
    });
    expect(isMissingClientPlatformTrialColumnError(err)).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isMissingClientPlatformTrialColumnError(new Error("connection refused"))).toBe(false);
  });
});
