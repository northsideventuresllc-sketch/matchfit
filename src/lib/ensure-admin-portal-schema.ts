import { Prisma } from "@/generated/prisma/client";
import { directPostgresUrlForDdl, runDirectPostgresDdl } from "@/lib/direct-postgres-ddl";
import { prisma } from "@/lib/prisma";

/** Server-only tables — RLS blocks Prisma when the pool role does not bypass RLS. */
export const ADMIN_PORTAL_SCHEMA_DDL = `
ALTER TABLE "administrators" ADD COLUMN IF NOT EXISTS "adminDashboardLayoutJson" TEXT;
ALTER TABLE public.administrators DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_administrator_registrations DISABLE ROW LEVEL SECURITY;
`;

const ADMIN_PORTAL_PRISMA_DDL_STATEMENTS = [
  `ALTER TABLE "administrators" ADD COLUMN IF NOT EXISTS "adminDashboardLayoutJson" TEXT`,
  `ALTER TABLE public.administrators DISABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.pending_administrator_registrations DISABLE ROW LEVEL SECURITY`,
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
  return e.code === "P2021" || e.code === "P2022";
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

/** Applies admin portal DDL when RLS or missing columns block Prisma reads/writes. */
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
 */
export async function ensureAdminPortalSchema(): Promise<void> {
  try {
    await countAdministrators();
    return;
  } catch (e) {
    if (!isAdminPortalSchemaError(e)) throw e;
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
