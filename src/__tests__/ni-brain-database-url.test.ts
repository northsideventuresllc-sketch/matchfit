import { describe, expect, it } from "vitest";
import {
  NI_BRAIN_PROJECT_REF,
  buildNiBrainDirectDatabaseUrl,
  buildNiBrainSessionPoolerDatabaseUrl,
  niBrainProjectRefFromSupabaseUrl,
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
      "postgresql://postgres.kxijunwgbrlfzvgkhklo:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
    );
  });

  it("prefers explicit database URL", () => {
    process.env.NI_BRAIN_DATABASE_URL = "postgresql://explicit";
    delete process.env.NI_BRAIN_DATABASE_PASSWORD;
    delete process.env.NI_BRAIN_SUPABASE_URL;
    expect(resolveNiBrainDatabaseUrlForDdl()).toBe("postgresql://explicit");
    delete process.env.NI_BRAIN_DATABASE_URL;
  });

  it("derives URL from password and Supabase URL", () => {
    delete process.env.NI_BRAIN_DATABASE_URL;
    process.env.NI_BRAIN_DATABASE_PASSWORD = "pw";
    process.env.NI_BRAIN_SUPABASE_URL = "https://kxijunwgbrlfzvgkhklo.supabase.co";
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    expect(resolveNiBrainDatabaseUrlForDdl()).toBe(
      "postgresql://postgres:pw@db.kxijunwgbrlfzvgkhklo.supabase.co:5432/postgres",
    );
    delete process.env.NI_BRAIN_DATABASE_PASSWORD;
    delete process.env.NI_BRAIN_SUPABASE_URL;
  });
});
