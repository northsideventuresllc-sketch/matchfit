import { Prisma } from "@/generated/prisma/client";
import { directPostgresUrlForDdl, runDirectPostgresDdl } from "@/lib/direct-postgres-ddl";
import { prisma } from "@/lib/prisma";

export const EMAIL_TEMPLATE_SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS "transactional_email_template_overrides" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "fieldsJson" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedByAdminId" TEXT,
  CONSTRAINT "transactional_email_template_overrides_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "transactional_email_template_overrides_kind_key" ON "transactional_email_template_overrides"("kind");

CREATE TABLE IF NOT EXISTS "pending_transactional_email_template_changes" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "kind" TEXT NOT NULL,
  "fieldsJson" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "requestedByAdminId" TEXT NOT NULL,
  "reviewNotes" TEXT,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "pending_transactional_email_template_changes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "pending_transactional_email_template_changes_kind_status_idx" ON "pending_transactional_email_template_changes"("kind", "status");
CREATE INDEX IF NOT EXISTS "pending_transactional_email_template_changes_requestedByAdminId_idx" ON "pending_transactional_email_template_changes"("requestedByAdminId");
`;

const PRISMA_DDL = [
  `CREATE TABLE IF NOT EXISTS "transactional_email_template_overrides" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fieldsJson" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedByAdminId" TEXT,
    CONSTRAINT "transactional_email_template_overrides_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "transactional_email_template_overrides_kind_key" ON "transactional_email_template_overrides"("kind")`,
  `CREATE TABLE IF NOT EXISTS "pending_transactional_email_template_changes" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "fieldsJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedByAdminId" TEXT NOT NULL,
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    CONSTRAINT "pending_transactional_email_template_changes_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "pending_transactional_email_template_changes_kind_status_idx" ON "pending_transactional_email_template_changes"("kind", "status")`,
  `CREATE INDEX IF NOT EXISTS "pending_transactional_email_template_changes_requestedByAdminId_idx" ON "pending_transactional_email_template_changes"("requestedByAdminId")`,
] as const;

export function isEmailTemplateSchemaError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  if (
    message.includes("transactional_email_template") &&
    (message.includes("does not exist") || message.includes("P2021"))
  ) {
    return true;
  }
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return e.code === "P2021" || e.code === "P2022";
}

let schemaEnsured = false;

export async function ensureEmailTemplateSchema(): Promise<void> {
  if (schemaEnsured) return;
  try {
    for (const stmt of PRISMA_DDL) {
      await prisma.$executeRawUnsafe(stmt);
    }
    schemaEnsured = true;
    return;
  } catch (e) {
    if (!isEmailTemplateSchemaError(e) && !isEmailTemplatePrismaUnavailable(e)) throw e;
  }
  const ddlUrl = directPostgresUrlForDdl();
  if (!ddlUrl) {
    if (process.env.NODE_ENV === "test") return;
    throw new Error("[ensureEmailTemplateSchema] No DIRECT_URL for DDL.");
  }
  await runDirectPostgresDdl(EMAIL_TEMPLATE_SCHEMA_DDL);
  schemaEnsured = true;
}

function isEmailTemplatePrismaUnavailable(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  return message.includes("$executeRawUnsafe is not a function") || message.includes("findMany is not a function");
}

export async function repairEmailTemplateSchema(): Promise<void> {
  schemaEnsured = false;
  await ensureEmailTemplateSchema();
}
