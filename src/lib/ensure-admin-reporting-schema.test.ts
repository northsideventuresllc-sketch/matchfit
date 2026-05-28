import { Prisma } from "@/generated/prisma/client";
import { describe, expect, it } from "vitest";
import { isMissingAdminReportingTableError } from "@/lib/ensure-admin-reporting-schema";

describe("isMissingAdminReportingTableError", () => {
  it("detects Postgres missing-table messages", () => {
    const err = new Error(
      'Invalid `prisma.platformRevenueEvent.count()` invocation: The table `public.platform_revenue_events` does not exist in the current database.',
    );
    expect(isMissingAdminReportingTableError(err)).toBe(true);
  });

  it("detects Prisma P2021", () => {
    const err = new Prisma.PrismaClientKnownRequestError("Table does not exist", {
      code: "P2021",
      clientVersion: "test",
      meta: { table: "public.platform_revenue_events" },
    });
    expect(isMissingAdminReportingTableError(err)).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isMissingAdminReportingTableError(new Error("connection refused"))).toBe(false);
  });
});
