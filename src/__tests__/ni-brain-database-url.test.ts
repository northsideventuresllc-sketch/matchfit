import { describe, expect, it } from "vitest";
import {
  NI_BRAIN_PROJECT_REF,
  buildNiBrainDirectDatabaseUrl,
  buildNiBrainSessionPoolerDatabaseUrl,
  niBrainProjectRefFromSupabaseUrl,
  normalizeNiBrainDatabaseUrlForDdl,
  normalizeNiBrainDatabaseUrlForSessionPooler,
  resolveNiBrainDatabaseUrlFallbackForDdl,
  resolveNiBrainDatabaseUrlForDdl,
} from "@/lib/ni-brain-database-url";

describe("ni-brain-database-url", () => {
  it("extracts project ref from Supabase URL", () => {
    expect(niBrainProjectRefFromSupabaseUrl("https://kxijunwgbrlfzvgkhklo.supabase.co")).toBe(NI_BRAIN_PROJECT_REF);
  });

  it("builds direct and session pooler URLs", () => {
    expect(buildNiBrainDirectDatabaseUrl({ projectRef: NI_BRAIN_PROJECT_REF, password: "secret" })).toBe(
      "postgresql://postgres:secret@db.kxijunwgbrlfzvgkhklo.supabase.co:5432/postgres",
    );
    expect(
      buildNiBrainSessionPoolerDatabaseUrl({ projectRef: NI_BRAIN_PROJECT_REF, password: "secret", region: "us-east-1" }),
    ).toBe(
      "postgresql://postgres.kxijunwgbrlfzvgkhklo:secret@aws-1-us-east-1.pooler.supabase.com:5432/postgres",
    );
  });

  it("normalizes pooler URLs to direct for local DDL", () => {
    expect(
      normalizeNiBrainDatabaseUrlForDdl(
        "postgresql://postgres.kxijunwgbrlfzvgkhklo:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
      ),
    ).toBe("postgresql://postgres:secret@db.kxijunwgbrlfzvgkhklo.supabase.co:5432/postgres");
  });

  it("normalizes direct URLs to session pooler for Vercel DDL", () => {
    expect(
      normalizeNiBrainDatabaseUrlForSessionPooler(
        "postgresql://postgres:secret@db.kxijunwgbrlfzvgkhklo.supabase.co:5432/postgres",
      ),
    ).toBe(
      "postgresql://postgres.kxijunwgbrlfzvgkhklo:secret@aws-1-us-east-1.pooler.supabase.com:5432/postgres",
    );
  });

  it("prefers explicit database URL", () => {
    process.env.NI_BRAIN_DATABASE_URL = "postgresql://explicit";
    delete process.env.NI_BRAIN_DATABASE_PASSWORD;
    delete process.env.NI_BRAIN_SUPABASE_URL;
    delete process.env.VERCEL;
    delete process.env.NI_BRAIN_DDL_USE_POOLER;
    expect(resolveNiBrainDatabaseUrlForDdl()).toBe("postgresql://explicit");
    delete process.env.NI_BRAIN_DATABASE_URL;
  });

  it("derives session pooler URL from password on Vercel", () => {
    delete process.env.NI_BRAIN_DATABASE_URL;
    process.env.NI_BRAIN_DATABASE_PASSWORD = "pw";
    process.env.NI_BRAIN_SUPABASE_URL = "https://kxijunwgbrlfzvgkhklo.supabase.co";
    process.env.VERCEL = "1";
    expect(resolveNiBrainDatabaseUrlForDdl()).toBe(
      "postgresql://postgres.kxijunwgbrlfzvgkhklo:pw@aws-1-us-east-1.pooler.supabase.com:5432/postgres",
    );
    delete process.env.NI_BRAIN_DATABASE_PASSWORD;
    delete process.env.NI_BRAIN_SUPABASE_URL;
    delete process.env.VERCEL;
  });

  it("falls back between direct and session pooler hosts", () => {
    expect(
      resolveNiBrainDatabaseUrlFallbackForDdl(
        "postgresql://postgres:secret@db.kxijunwgbrlfzvgkhklo.supabase.co:5432/postgres",
      ),
    ).toBe(
      "postgresql://postgres.kxijunwgbrlfzvgkhklo:secret@aws-1-us-east-1.pooler.supabase.com:5432/postgres",
    );
  });
});
