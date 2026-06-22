import { Prisma } from "@/generated/prisma/client";
import { describe, expect, it } from "vitest";
import { isAdminPortalConnectionError, isAdminPortalSchemaError } from "@/lib/ensure-admin-portal-schema";

describe("ensure-admin-portal-schema", () => {
  it("detects RLS and missing-table errors", () => {
    expect(
      isAdminPortalSchemaError(new Error('permission denied for table "administrators"')),
    ).toBe(true);
  });

  it("does not treat unrelated missing-column errors as admin portal schema errors", () => {
    const err = new Prisma.PrismaClientKnownRequestError("Column does not exist", {
      code: "P2022",
      clientVersion: "test",
      meta: { column: "clients.vipSubscriptionActive" },
    });
    expect(isAdminPortalSchemaError(err)).toBe(false);
  });

  it("detects database connection failures", () => {
    expect(
      isAdminPortalConnectionError(new Error("Can't reach database server at db.example.supabase.co")),
    ).toBe(true);
  });
});
