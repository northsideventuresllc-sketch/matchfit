import { describe, expect, it } from "vitest";
import { isAdminPortalConnectionError, isAdminPortalSchemaError } from "@/lib/ensure-admin-portal-schema";

describe("ensure-admin-portal-schema", () => {
  it("detects RLS and missing-table errors", () => {
    expect(
      isAdminPortalSchemaError(new Error('permission denied for table "administrators"')),
    ).toBe(true);
  });

  it("detects database connection failures", () => {
    expect(
      isAdminPortalConnectionError(new Error("Can't reach database server at db.example.supabase.co")),
    ).toBe(true);
  });
});
