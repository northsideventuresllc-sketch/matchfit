import { Prisma } from "@/generated/prisma/client";
import { directPostgresUrlForDdl, runDirectPostgresDdl } from "@/lib/direct-postgres-ddl";
import { prisma } from "@/lib/prisma";

/**
 * Server-only schema-drift repair: adds a column that may be missing on older
 * databases. This must NEVER touch Row Level Security — a permission/RLS-shaped
 * error on these tables is a configuration problem to fix by hand (or a real
 * attempt to read data the app role should not see), not something this
 * runtime path is allowed to "fix" by disabling RLS. Do not add
 * `DISABLE ROW LEVEL SECURITY` (or any RLS-weakening statement) back here —
 * see the 2026-09 security audit and `docs/supabase-rls-sensitive-tables.md`.
 */
export const ADMIN_PORTAL_SCHEMA_DDL = `
ALTER TABLE "administrators" ADD COLUMN IF NOT EXISTS "adminDashboardLayoutJson" TEXT;
`;

const ADMIN_PORTAL_PRISMA_DDL_STATEMENTS = [
  `ALTER TABLE "administrators" ADD COLUMN IF NOT EXISTS "adminDashboardLayoutJson" TEXT`,
] as const;

export function isAdminPortalSchemaError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  if (
    message.includes("administrators") &&
    (message.includes("permission denied") ||
      message.includes("42501") ||
      message.includes("row-level security") ||
      message.includes("P2021") ||
      message.includes("does not exist"))
  ) {
    return true;
  }
  if (
    message.includes("pending_administrator_registrations") &&
    (message.includes("permission denied") ||
      message.includes("42501") ||
      message.includes("row-level security") ||
      message.includes("P2021") ||
      message.includes("does not exist"))
  ) {
    return true;
  }
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (e.code !== "P2021" && e.code !== "P2022") return false;
  const metaTable = String((e.meta as { table?: string })?.table ?? "");
  const metaModel = String((e.meta as { modelName?: string })?.modelName ?? "");
  return (
    message.includes("administrators") ||
    message.includes("pending_administrator_registrations") ||
    message.includes("adminDashboardLayoutJson") ||
    metaTable.includes("administrators") ||
    metaTable.includes("pending_administrator_registrations") ||
    metaModel === "Administrator" ||
    metaModel === "PendingAdministratorRegistration"
  );
}

export function isAdminPortalConnectionError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  if (message.includes("Can't reach database server") || message.includes("P1001")) {
    return true;
  }
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return e.code === "P1001";
}

export async function countAdministrators(): Promise<number> {
  return prisma.administrator.count();
}

async function runAdminPortalPrismaDdl(): Promise<void> {
  for (const statement of ADMIN_PORTAL_PRISMA_DDL_STATEMENTS) {
    await prisma.$executeRawUnsafe(statement);
  }
}

async function runAdminPortalDirectDdl(): Promise<void> {
  const ddlUrl = directPostgresUrlForDdl();
  if (!ddlUrl) {
    throw new Error(
      "[ensureAdminPortalSchema] No DIRECT_URL and could not derive a 5432 Postgres URL from DATABASE_URL.",
    );
  }
  await runDirectPostgresDdl(ADMIN_PORTAL_SCHEMA_DDL);
}

/**
 * Applies admin portal schema-drift DDL (currently: adding a missing column).
 * Does NOT and must NOT touch Row Level Security — see the DDL comment above.
 */
export async function repairAdminPortalSchema(): Promise<void> {
  try {
    await runAdminPortalPrismaDdl();
    return;
  } catch (e) {
    if (!isAdminPortalSchemaError(e) && !isAdminPortalConnectionError(e)) {
      throw e;
    }
  }
  await runAdminPortalDirectDdl();
}

/**
 * Ensures administrator tables are readable by the app runtime role.
 * Fast path: skip DDL when reads already work.
 *
 * This only ever repairs schema drift (a missing column) — a permission or
 * Row-Level-Security-shaped failure is never "fixed" here; it is logged and
 * rethrown so callers surface a clean failure instead of the app silently
 * weakening database security to keep working.
 */
export async function ensureAdminPortalSchema(): Promise<void> {
  try {
    await countAdministrators();
    return;
  } catch (e) {
    if (!isAdminPortalSchemaError(e)) throw e;
    console.error("[ensureAdminPortalSchema] administrator table read failed; attempting schema-drift repair only (RLS is never modified)", e);
  }

  await repairAdminPortalSchema();
  await countAdministrators();
}

export async function probeAdministratorRead(): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await ensureAdminPortalSchema();
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
