import type { TransactionalEmailKind } from "@/lib/transactional-email-kinds";
import {
  getDefaultTransactionalEmailTemplateFields,
  transactionalEmailTemplatePlaceholders,
} from "@/lib/transactional-email-template-defaults";
import {
  mergeTransactionalEmailTemplateFields,
  parseTransactionalEmailTemplateFieldsJson,
  serializeTransactionalEmailTemplateFields,
  type TransactionalEmailTemplateFields,
} from "@/lib/transactional-email-template-types";
import { compileTransactionalEmail } from "@/lib/transactional-email-template-compile";
import { buildTransactionalEmail, sampleContextForTransactionalEmail } from "@/lib/transactional-email-templates";
import { transactionalEmailKindSampleLabel, TRANSACTIONAL_EMAIL_KINDS } from "@/lib/transactional-email-kinds";
import { prisma } from "@/lib/prisma";
import { ensureEmailTemplateSchema } from "@/lib/ensure-email-template-schema";

const overrideCache = new Map<TransactionalEmailKind, TransactionalEmailTemplateFields | null>();
let cacheLoaded = false;

export function invalidateTransactionalEmailTemplateCache(kind?: TransactionalEmailKind): void {
  if (kind) {
    overrideCache.delete(kind);
    return;
  }
  overrideCache.clear();
  cacheLoaded = false;
}

async function loadOverrideCache(): Promise<void> {
  if (cacheLoaded) return;
  try {
    await ensureEmailTemplateSchema();
    const rows = await prisma.transactionalEmailTemplateOverride.findMany();
    overrideCache.clear();
    for (const row of rows) {
      const parsed = parseTransactionalEmailTemplateFieldsJson(row.fieldsJson);
      if (parsed) {
        overrideCache.set(row.kind as TransactionalEmailKind, parsed);
      }
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "test") {
      console.error("[transactional-email-template-store] override cache load failed", e);
    }
  }
  cacheLoaded = true;
}

export async function getTransactionalEmailTemplateOverride(
  kind: TransactionalEmailKind,
): Promise<TransactionalEmailTemplateFields | null> {
  await loadOverrideCache();
  return overrideCache.get(kind) ?? null;
}

export function resolveTransactionalEmailTemplateFields(
  kind: TransactionalEmailKind,
  override: TransactionalEmailTemplateFields | null | undefined,
): TransactionalEmailTemplateFields {
  const defaults = getDefaultTransactionalEmailTemplateFields(kind);
  if (!override) return defaults;
  return mergeTransactionalEmailTemplateFields(defaults, override);
}

export async function getEffectiveTransactionalEmailTemplateFields(
  kind: TransactionalEmailKind,
): Promise<TransactionalEmailTemplateFields> {
  const override = await getTransactionalEmailTemplateOverride(kind);
  return resolveTransactionalEmailTemplateFields(kind, override);
}

export async function buildTransactionalEmailWithOverrides(
  kind: TransactionalEmailKind,
  ctx: Record<string, string>,
): Promise<{ subject: string; text: string; html: string }> {
  const fields = await getEffectiveTransactionalEmailTemplateFields(kind);
  return compileTransactionalEmail(kind, ctx, fields);
}

/** Preview using sample context — for admin UI. */
export function previewTransactionalEmailTemplate(
  kind: TransactionalEmailKind,
  fields: TransactionalEmailTemplateFields,
): { subject: string; text: string; html: string } {
  const ctx = sampleContextForTransactionalEmail(kind);
  return compileTransactionalEmail(kind, ctx, fields);
}

export async function listTransactionalEmailTemplatesForAdmin(): Promise<
  {
    kind: TransactionalEmailKind;
    label: string;
    placeholders: string[];
    fields: TransactionalEmailTemplateFields;
    hasOverride: boolean;
    hasPendingChange: boolean;
  }[]
> {
  try {
    await ensureEmailTemplateSchema();
    await loadOverrideCache();
  } catch {
    /* fall through with defaults */
  }

  let pendingKinds = new Set<string>();
  try {
    pendingKinds = new Set(
      (
        await prisma.pendingTransactionalEmailTemplateChange.findMany({
          where: { status: "PENDING" },
          select: { kind: true },
        })
      ).map((r) => r.kind),
    );
  } catch {
    pendingKinds = new Set();
  }

  return TRANSACTIONAL_EMAIL_KINDS.map((kind) => {
    const override = overrideCache.get(kind) ?? null;
    const fields = resolveTransactionalEmailTemplateFields(kind, override);
    return {
      kind,
      label: transactionalEmailKindSampleLabel(kind),
      placeholders: transactionalEmailTemplatePlaceholders(kind),
      fields,
      hasOverride: override !== null,
      hasPendingChange: pendingKinds.has(kind),
    };
  });
}

export async function saveTransactionalEmailTemplateOverride(opts: {
  kind: TransactionalEmailKind;
  fields: TransactionalEmailTemplateFields;
  adminId: string;
}): Promise<void> {
  await ensureEmailTemplateSchema();
  const json = serializeTransactionalEmailTemplateFields(opts.fields);
  await prisma.transactionalEmailTemplateOverride.upsert({
    where: { kind: opts.kind },
    create: {
      kind: opts.kind,
      fieldsJson: json,
      updatedByAdminId: opts.adminId,
    },
    update: {
      fieldsJson: json,
      updatedByAdminId: opts.adminId,
    },
  });
  invalidateTransactionalEmailTemplateCache(opts.kind);
}

export async function applyPendingEmailTemplateChange(pendingId: string): Promise<TransactionalEmailKind | null> {
  await ensureEmailTemplateSchema();
  const pending = await prisma.pendingTransactionalEmailTemplateChange.findUnique({
    where: { id: pendingId },
  });
  if (!pending || pending.status !== "PENDING") return null;

  const fields = parseTransactionalEmailTemplateFieldsJson(pending.fieldsJson);
  if (!fields) return null;

  const kind = pending.kind as TransactionalEmailKind;
  await prisma.$transaction([
    prisma.transactionalEmailTemplateOverride.upsert({
      where: { kind },
      create: {
        kind,
        fieldsJson: pending.fieldsJson,
        updatedByAdminId: pending.requestedByAdminId,
      },
      update: {
        fieldsJson: pending.fieldsJson,
        updatedByAdminId: pending.requestedByAdminId,
      },
    }),
    prisma.pendingTransactionalEmailTemplateChange.update({
      where: { id: pendingId },
      data: { status: "APPROVED", reviewedAt: new Date() },
    }),
  ]);
  invalidateTransactionalEmailTemplateCache(kind);
  return kind;
}

/** Compare compiled output to ensure template fields are valid. */
export function validateTransactionalEmailTemplateFields(
  kind: TransactionalEmailKind,
  fields: TransactionalEmailTemplateFields,
): string | null {
  if (!fields.subject.trim()) return "Subject is required.";
  if (!fields.title.trim()) return "Hero title is required.";
  if (!fields.textBody.trim()) return "Plain-text body is required.";
  if (fields.bodyParagraphs.length === 0 || fields.bodyParagraphs.every((p) => !p.trim())) {
    return "At least one body paragraph is required.";
  }
  try {
    previewTransactionalEmailTemplate(kind, fields);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Could not compile template.";
  }
}

/** Backward-compatible check: compiled defaults match legacy builder for sample ctx. */
export function assertTemplateCompileParity(kind: TransactionalEmailKind): boolean {
  const ctx = sampleContextForTransactionalEmail(kind);
  const legacy = buildTransactionalEmail(kind, ctx);
  const compiled = compileTransactionalEmail(kind, ctx, getDefaultTransactionalEmailTemplateFields(kind));
  return legacy.subject === compiled.subject && legacy.text === compiled.text;
}
