import { Prisma } from "@/generated/prisma/client";
import { directPostgresUrlForDdl, runDirectPostgresDdl } from "@/lib/direct-postgres-ddl";
import { prisma } from "@/lib/prisma";

/** Server-only tables — RLS blocks Prisma when the pool role does not bypass RLS. */
export const ADMIN_PORTAL_SCHEMA_DDL = `
ALTER TABLE "administrators" ADD COLUMN IF NOT EXISTS "adminDashboardLayoutJson" TEXT;
ALTER TABLE public.administrators DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_administrator_registrations DISABLE ROW LEVEL SECURITY;
`;

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
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return e.code === "P2021" || e.code === "P2022";
}

export async function countAdministrators(): Promise<number> {
  return prisma.administrator.count();
}

export async function ensureAdminPortalSchema(): Promise<void> {
  const ddlUrl = directPostgresUrlForDdl();
  if (!ddlUrl) {
    throw new Error(
      "[ensureAdminPortalSchema] No DIRECT_URL and could not derive a 5432 Postgres URL from DATABASE_URL.",
    );
  }
  await runDirectPostgresDdl(ADMIN_PORTAL_SCHEMA_DDL);
}

export async function probeAdministratorRead(): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await ensureAdminPortalSchema();
    await prisma.administrator.count();
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
