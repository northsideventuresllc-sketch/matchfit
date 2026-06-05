import { describe, expect, it } from "vitest";
import {
  deriveDirectPostgresUrlFromDatabaseUrl,
  directPostgresUrlForDdl,
} from "@/lib/direct-postgres-ddl";

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

describe("directPostgresUrlForDdl", () => {
  it("uses db.* host from DATABASE_URL when DIRECT_URL is the transaction pooler (local)", () => {
    const prevDb = process.env.DATABASE_URL;
    const prevDirect = process.env.DIRECT_URL;
    const prevVercel = process.env.VERCEL;
    delete process.env.VERCEL;
    process.env.DATABASE_URL =
      "postgresql://postgres:secret@db.qtesdsxrfggdlxdaraaq.supabase.co:5432/postgres?sslmode=require";
    process.env.DIRECT_URL =
      "postgresql://postgres.qtesdsxrfggdlxdaraaq:secret@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true";
    try {
      expect(directPostgresUrlForDdl()).toBe(
        "postgresql://postgres:secret@db.qtesdsxrfggdlxdaraaq.supabase.co:5432/postgres",
      );
    } finally {
      if (prevDb === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prevDb;
      if (prevDirect === undefined) delete process.env.DIRECT_URL;
      else process.env.DIRECT_URL = prevDirect;
      if (prevVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = prevVercel;
    }
  });

  it("uses session pooler on Vercel when DIRECT_URL is the transaction pooler", () => {
    const prevDb = process.env.DATABASE_URL;
    const prevDirect = process.env.DIRECT_URL;
    const prevVercel = process.env.VERCEL;
    process.env.VERCEL = "1";
    process.env.DATABASE_URL =
      "postgresql://postgres:secret@db.qtesdsxrfggdlxdaraaq.supabase.co:5432/postgres?sslmode=require";
    process.env.DIRECT_URL =
      "postgresql://postgres.qtesdsxrfggdlxdaraaq:secret@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true";
    try {
      expect(directPostgresUrlForDdl()).toBe(
        "postgresql://postgres.qtesdsxrfggdlxdaraaq:secret@aws-1-us-east-2.pooler.supabase.com:5432/postgres",
      );
    } finally {
      if (prevDb === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prevDb;
      if (prevDirect === undefined) delete process.env.DIRECT_URL;
      else process.env.DIRECT_URL = prevDirect;
      if (prevVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = prevVercel;
    }
  });
});
