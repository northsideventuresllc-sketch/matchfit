import type { TransactionalEmailKind } from "@/lib/transactional-email-kinds";

/** Layout variants for branded transactional emails. */
export type TransactionalEmailTemplateLayout =
  | { type: "standard"; ctaHrefKey?: string }
  | { type: "otp"; codeKey?: string }
  | {
      type: "dual-action";
      approveUrlKey?: string;
      denyUrlKey?: string;
    }
  | {
      type: "confirm-button";
      confirmUrlKey?: string;
      confirmLabel?: string;
    }
  | { type: "booking-session" };

/** Editable fields stored in the admin email template editor. */
export type TransactionalEmailTemplateFields = {
  subject: string;
  preheader: string;
  title: string;
  bodyParagraphs: string[];
  textBody: string;
  ctaLabel?: string | null;
  ctaHrefKey?: string | null;
  layout: TransactionalEmailTemplateLayout;
};

export type TransactionalEmailTemplateMeta = {
  kind: TransactionalEmailKind;
  label: string;
  placeholders: string[];
  hasPendingChange?: boolean;
};

export function mergeTransactionalEmailTemplateFields(
  base: TransactionalEmailTemplateFields,
  patch: Partial<TransactionalEmailTemplateFields>,
): TransactionalEmailTemplateFields {
  return {
    subject: patch.subject ?? base.subject,
    preheader: patch.preheader ?? base.preheader,
    title: patch.title ?? base.title,
    bodyParagraphs: patch.bodyParagraphs ?? base.bodyParagraphs,
    textBody: patch.textBody ?? base.textBody,
    ctaLabel: patch.ctaLabel !== undefined ? patch.ctaLabel : base.ctaLabel,
    ctaHrefKey: patch.ctaHrefKey !== undefined ? patch.ctaHrefKey : base.ctaHrefKey,
    layout: patch.layout ?? base.layout,
  };
}

export function parseTransactionalEmailTemplateFieldsJson(raw: string): TransactionalEmailTemplateFields | null {
  try {
    const parsed = JSON.parse(raw) as Partial<TransactionalEmailTemplateFields>;
    if (
      typeof parsed.subject !== "string" ||
      typeof parsed.preheader !== "string" ||
      typeof parsed.title !== "string" ||
      !Array.isArray(parsed.bodyParagraphs) ||
      typeof parsed.textBody !== "string" ||
      !parsed.layout ||
      typeof parsed.layout !== "object"
    ) {
      return null;
    }
    return {
      subject: parsed.subject,
      preheader: parsed.preheader,
      title: parsed.title,
      bodyParagraphs: parsed.bodyParagraphs.filter((p): p is string => typeof p === "string"),
      textBody: parsed.textBody,
      ctaLabel: typeof parsed.ctaLabel === "string" ? parsed.ctaLabel : parsed.ctaLabel === null ? null : undefined,
      ctaHrefKey: typeof parsed.ctaHrefKey === "string" ? parsed.ctaHrefKey : parsed.ctaHrefKey === null ? null : undefined,
      layout: parsed.layout as TransactionalEmailTemplateLayout,
    };
  } catch {
    return null;
  }
}

export function serializeTransactionalEmailTemplateFields(fields: TransactionalEmailTemplateFields): string {
  return JSON.stringify(fields);
}
