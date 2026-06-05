import { describe, expect, it } from "vitest";
import {
  isSupabaseDirectDbHost,
  isSupabasePoolerHost,
  resolvePrismaDatabaseUrl,
} from "@/lib/supabase-database-url";

describe("supabase-database-url", () => {
  it("detects Supabase direct and pooler hosts", () => {
    expect(isSupabaseDirectDbHost("postgresql://postgres:pw@db.abc123.supabase.co:5432/postgres")).toBe(true);
    expect(
      isSupabasePoolerHost(
        "postgresql://postgres.abc123:pw@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true",
      ),
    ).toBe(true);
  });

  it("uses DIRECT_URL pooler when DATABASE_URL was set to the direct host", () => {
    const prevDb = process.env.DATABASE_URL;
    const prevDirect = process.env.DIRECT_URL;
    process.env.DATABASE_URL =
      "postgresql://postgres:pw@db.abc123.supabase.co:5432/postgres?sslmode=require";
    process.env.DIRECT_URL =
      "postgresql://postgres.abc123:pw@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true";
    try {
      expect(resolvePrismaDatabaseUrl()).toBe(process.env.DIRECT_URL);
    } finally {
      if (prevDb === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prevDb;
      if (prevDirect === undefined) delete process.env.DIRECT_URL;
      else process.env.DIRECT_URL = prevDirect;
    }
  });
});
