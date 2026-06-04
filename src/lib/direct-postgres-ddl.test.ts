import { describe, expect, it } from "vitest";
import { deriveDirectPostgresUrlFromDatabaseUrl } from "@/lib/direct-postgres-ddl";

describe("deriveDirectPostgresUrlFromDatabaseUrl", () => {
  it("prefers db.PROJECT_REF.supabase.co for Supabase pooler URLs", () => {
    const derived = deriveDirectPostgresUrlFromDatabaseUrl(
      "postgresql://postgres.abc123:secret@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require",
    );
    expect(derived).toBe("postgresql://postgres:secret@db.abc123.supabase.co:5432/postgres");
  });

  it("falls back to session pooler port 5432 when project ref is unknown", () => {
    const derived = deriveDirectPostgresUrlFromDatabaseUrl(
      "postgresql://postgres:secret@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true",
    );
    expect(derived).toContain("aws-1-us-east-2.pooler.supabase.com:5432/postgres");
    expect(derived).not.toContain("pgbouncer");
  });
});
