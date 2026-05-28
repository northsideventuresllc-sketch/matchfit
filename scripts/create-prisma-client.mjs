import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

function scriptDatabaseUrl() {
  // Pooled URL first — direct `db.*.supabase.co` is often unreachable from CI/agents.
  return (process.env.DATABASE_URL ?? process.env.DIRECT_URL)?.trim() || null;
}

function isSupabaseHost(connectionString) {
  try {
    const host = new URL(connectionString).hostname;
    return host.includes("supabase.com") || host.includes("supabase.co");
  } catch {
    return false;
  }
}

/** Drop `sslmode` so pg Pool `ssl` options apply (agent/CI TLS intercept friendly). */
function normalizeScriptConnectionString(connectionString) {
  try {
    const url = new URL(connectionString);
    url.searchParams.delete("sslmode");
    return url.toString();
  } catch {
    return connectionString;
  }
}

/** Prisma v7 client for Node scripts (Direct TCP via pg adapter). */
export function createPrismaClient() {
  const raw = scriptDatabaseUrl();
  if (!raw) {
    throw new Error("DIRECT_URL or DATABASE_URL is required.");
  }
  const connectionString = normalizeScriptConnectionString(raw);
  const pool = new pg.Pool({
    connectionString,
    ssl: isSupabaseHost(raw) ? { rejectUnauthorized: false } : undefined,
    max: 3,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}
