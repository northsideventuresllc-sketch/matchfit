import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  BILLING_UNITS,
  BILLING_UNIT_LABELS,
  MATCH_SERVICE_CATALOG,
  SERVICE_DELIVERY_MODES,
  billingUnitIsCadencePackBase,
  matchServiceAllowsMultiSessionBilling,
  serviceOfferingCadenceBillingTemplates,
  serviceOfferingIsDiyTemplate,
  serviceOfferingNeedsSessionLength,
  type BillingUnit,
  type MatchServiceId,
  type ServiceDeliveryMode,
  buildAiMatchProfileText,
  trainerMatchQuestionnaireSchema,
  type TrainerMatchQuestionnairePayload,
} from "@/lib/trainer-match-questionnaire";
import { parseTrainerMatchQuestionnaireDraft } from "@/lib/trainer-match-questionnaire-draft";
import { formatTrainerServicePriceUsd } from "@/lib/trainer-service-price-display";

const matchServiceIdSchema = z
  .string()
  .refine((id): id is MatchServiceId => MATCH_SERVICE_CATALOG.some((s) => s.id === id), "Invalid service.");

/** Max length for optional coach-defined title shown on the public profile (template label is the fallback). */
export const TRAINER_SERVICE_PUBLIC_TITLE_MAX = 80;

/** Session length (minutes) when a template requires it (variations and single-price rows). */
export const TRAINER_SERVICE_SESSION_MINUTES_MIN = 30;
export const TRAINER_SERVICE_SESSION_MINUTES_MAX = 120;

export function clampTrainerServiceSessionMinutes(n: number): number {
  return Math.min(
    TRAINER_SERVICE_SESSION_MINUTES_MAX,
    Math.max(TRAINER_SERVICE_SESSION_MINUTES_MIN, Math.floor(n)),
  );
}

export const SESSION_FREQUENCY_KINDS = ["per_week", "per_month", "custom", "none"] as const;
export type SessionFrequencyKind = (typeof SESSION_FREQUENCY_KINDS)[number];

export type ServiceOfferingFrequencyDto = {
  sessionFrequencyKind: SessionFrequencyKind;
  sessionFrequencyCount?: number;
  sessionFrequencyCustom?: string;
  /** Legacy alias for `sessionFrequencyCount` when kind is `per_week`. */
  sessionsPerWeek?: number;
};

/** Normalizes frequency fields on a line from dashboard / API payloads. */
export function mergeServiceOfferingFrequencyFields(line: TrainerServiceOfferingLine, body: ServiceOfferingFrequencyDto): void {
  const fk = body.sessionFrequencyKind;
  line.sessionFrequencyKind = fk;
  if (fk === "none") {
    delete line.sessionFrequencyCount;
    delete line.sessionFrequencyCustom;
    delete line.sessionsPerWeek;
    return;
  }
  if (fk === "per_week") {
    const n = body.sessionFrequencyCount ?? body.sessionsPerWeek;
    if (n != null) {
      line.sessionFrequencyCount = n;
      line.sessionsPerWeek = n;
    }
    delete line.sessionFrequencyCustom;
    return;
  }
  if (fk === "per_month") {
    if (body.sessionFrequencyCount != null) line.sessionFrequencyCount = body.sessionFrequencyCount;
    delete line.sessionsPerWeek;
    delete line.sessionFrequencyCustom;
    return;
  }
  if (fk === "custom") {
    const c = body.sessionFrequencyCustom?.trim();
    if (c) line.sessionFrequencyCustom = c;
    delete line.sessionFrequencyCount;
    delete line.sessionsPerWeek;
  }
}

export const trainerServiceOfferingBundleTierSchema = z.object({
  tierId: z.string().trim().min(2).max(48),
  quantity: z.number().int().min(2).max(52),
  priceUsd: z.number().min(15).max(50_000),
  label: z.string().trim().max(80).optional(),
  /** When set, dashboard derived tier total from base row using this discount (0–90). */
  discountPercent: z.number().min(0).max(90).optional(),
});

const addOnBillingUnits = ["per_session", "per_hour"] as const;

export const trainerServiceOfferingAddOnSchema = z
  .object({
    addonId: z.string().trim().min(1).max(48),
    /** Client-visible title (coach-editable). */
    label: z.string().trim().min(1).max(140),
    /** Preset / catalog description of what the add-on is. */
    description: z.string().trim().max(280).optional(),
    /** Coach-specific note: what makes their version unique. */
    coachSummary: z.string().trim().max(400).optional(),
    /** Add-on list price (required together with `billingUnit` for new dashboard publishes). */
    priceUsd: z.number().min(15).max(5000).optional(),
    /** Per time (session-style) vs hourly. */
    billingUnit: z.enum(addOnBillingUnits).optional(),
  })
  .superRefine((a, ctx) => {
    const hasP = a.priceUsd != null && Number.isFinite(a.priceUsd);
    const hasB = a.billingUnit != null;
    if (hasP !== hasB) {
      ctx.addIssue({
        code: "custom",
        message: "Optional add-ons need both a price and a billing unit (or neither for legacy rows).",
        path: hasP ? ["billingUnit"] : ["priceUsd"],
      });
    }
  });

export type TrainerServiceOfferingAddOn = z.infer<typeof trainerServiceOfferingAddOnSchema>;

export const trainerServiceOfferingVariationSchema = z.object({
  variationId: z.string().trim().min(2).max(48),
  label: z.string().trim().min(1).max(80),
  /** Optional extra client-facing copy for this checkout row (shown on profile / checkout when present). */
  variationDescription: z.string().trim().max(400).optional(),
  /** How many sessions this checkout row covers (1–20); required for per-session rows except DIY templates. */
  sessionCount: z.number().int().min(1).max(20).optional(),
  sessionMinutes: z.number().int().min(TRAINER_SERVICE_SESSION_MINUTES_MIN).max(TRAINER_SERVICE_SESSION_MINUTES_MAX).optional(),
  priceUsd: z.number().min(15).max(5000),
  billingUnit: z.enum(BILLING_UNITS),
  bundleTiers: z.array(trainerServiceOfferingBundleTierSchema).max(8).optional(),
});

/** Per-session rows on non-DIY templates must declare how many sessions the price covers (max 20). */
export function variationRequiresSessionCount(
  serviceId: MatchServiceId | null | undefined,
  billingUnit: BillingUnit,
): boolean {
  if (!serviceId) return false;
  if (!serviceId || serviceOfferingIsDiyTemplate(serviceId) || serviceOfferingCadenceBillingTemplates(serviceId)) {
    return false;
  }
  return billingUnit === "per_session" || billingUnit === "per_person";
}

/** Client-facing unit word for bundle tier quantity (sessions, weeks, months, etc.). */
export function bundleTierQuantityUnitPhrase(lineBillingUnit: BillingUnit): string {
  if (lineBillingUnit === "per_hour") return "hours";
  if (billingUnitIsCadencePackBase(lineBillingUnit)) {
    if (lineBillingUnit === "per_week") return "weeks";
    if (lineBillingUnit === "twice_weekly") return "two-week blocks";
    return "months";
  }
  return "sessions";
}

/** Default tier label when the coach adds a prepay tier (sessions, weeks, etc.). */
export function bundleTierSuggestLabel(quantity: number, lineBillingUnit: BillingUnit): string {
  const q = Math.max(2, Math.floor(quantity));
  if (lineBillingUnit === "per_hour") return `${q}-hour bundle`;
  if (lineBillingUnit === "per_week") return `${q}-week bundle`;
  if (lineBillingUnit === "twice_weekly") return `${q}× semi-week bundle`;
  if (lineBillingUnit === "per_month") return `${q}-month bundle`;
  if (lineBillingUnit === "per_person") return `${q}-session pack (per person)`;
  return `${q}-pack`;
}

/** Tier list price from base row, unit count, tier size, and % off (stored totals must stay ≥ $15). */
export function computeBundleTierTotalFromDiscount(args: {
  billingUnit: BillingUnit;
  basePriceUsd: number;
  baseUnitCount: number;
  tierQuantity: number;
  discountPercent: number;
}): number {
  const pct = Math.min(90, Math.max(0, args.discountPercent));
  const f = 1 - pct / 100;
  if (billingUnitIsCadencePackBase(args.billingUnit)) {
    return Math.max(15, Math.round(args.basePriceUsd * args.tierQuantity * f * 100) / 100);
  }
  const units = Math.max(1, args.baseUnitCount);
  const unitRate = args.basePriceUsd / units;
  return Math.max(15, Math.round(unitRate * args.tierQuantity * f * 100) / 100);
}

/** Bundle tiers on the single list-price row (no variations). Uses one billing unit × list price as the base rate. */
export function bundleTierPriceFromMainOfferingLine(args: {
  billingUnit: BillingUnit;
  basePriceUsd: number;
  tierQuantity: number;
  discountPercent?: number;
}): number {
  return computeBundleTierTotalFromDiscount({
    billingUnit: args.billingUnit,
    basePriceUsd: args.basePriceUsd,
    baseUnitCount: 1,
    tierQuantity: args.tierQuantity,
    discountPercent: args.discountPercent ?? 0,
  });
}

export type TrainerServiceOfferingBundleTier = z.infer<typeof trainerServiceOfferingBundleTierSchema>;
export type TrainerServiceOfferingVariation = z.infer<typeof trainerServiceOfferingVariationSchema>;

export const trainerServiceOfferingLineSchema = z.object({
  serviceId: matchServiceIdSchema,
  /** Optional client-facing title; when absent, the catalog template label is shown. */
  publicTitle: z.string().trim().max(TRAINER_SERVICE_PUBLIC_TITLE_MAX).optional(),
  priceUsd: z.number().min(15).max(5000),
  billingUnit: z.enum(BILLING_UNITS),
  description: z.string().trim().max(600).optional(),
  sessionMinutes: z.number().int().min(TRAINER_SERVICE_SESSION_MINUTES_MIN).max(TRAINER_SERVICE_SESSION_MINUTES_MAX).optional(),
  /** @deprecated Prefer `sessionFrequencyKind` + `sessionFrequencyCount` for per-week cadence. */
  sessionsPerWeek: z.number().int().min(1).max(14).optional(),
  sessionFrequencyKind: z.enum(SESSION_FREQUENCY_KINDS).optional(),
  sessionFrequencyCount: z.number().int().min(1).max(31).optional(),
  sessionFrequencyCustom: z.string().trim().max(120).optional(),
  delivery: z.enum(SERVICE_DELIVERY_MODES),
  /** Optional length / package rows; when set, checkout uses these rows (and optional bundle tiers) instead of the single line price. */
  variations: z.array(trainerServiceOfferingVariationSchema).max(24).optional(),
  /** Volume tiers when there are no `variations` — same shape as per-variation bundle tiers. */
  bundleTiers: z.array(trainerServiceOfferingBundleTierSchema).max(8).optional(),
  /** When false, dashboard “Review” skips OpenAI and uses benchmarks only. Defaults to on when unset. */
  priceCheckAiEnabled: z.boolean().optional(),
  /** Optional upsells (motivational check-ins, meal-prep add-ons, etc.). */
  optionalAddOns: z.array(trainerServiceOfferingAddOnSchema).max(12).optional(),
  /** Profile listing: shown vs hidden on the public services block. */
  siteVisibility: z.enum(["visible", "hidden"]).optional(),
  /** Purchase state: bookable vs paused (still visible when site is visible). */
  clientBookingAvailability: z.enum(["available", "unavailable"]).optional(),
});

export type TrainerServiceOfferingLine = z.infer<typeof trainerServiceOfferingLineSchema>;

export const trainerServiceOfferingsDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    services: z.array(trainerServiceOfferingLineSchema),
    inPersonServiceZip: z.string().trim().max(12).optional().nullable(),
    inPersonServiceRadiusMiles: z.number().int().min(1).max(150).optional().nullable(),
  })
  .superRefine((doc, ctx) => {
    const seen = new Set<string>();
    for (let i = 0; i < doc.services.length; i++) {
      const line = doc.services[i]!;
      if (seen.has(line.serviceId)) {
        ctx.addIssue({
          code: "custom",
          message: "Each service type can only appear once.",
          path: ["services", i, "serviceId"],
        });
        break;
      }
      seen.add(line.serviceId);
      const row = MATCH_SERVICE_CATALOG.find((s) => s.id === line.serviceId);
      if (!row) continue;
      if (line.delivery === "virtual" && !row.virtual) {
        ctx.addIssue({
          code: "custom",
          message: "This service cannot be delivered virtually on Match Fit.",
          path: ["services", i, "delivery"],
        });
      }
      if (line.delivery === "in_person" && !row.inPerson) {
        ctx.addIssue({
          code: "custom",
          message: "This service cannot be delivered in person on Match Fit.",
          path: ["services", i, "delivery"],
        });
      }
      if (line.delivery === "both" && (!row.virtual || !row.inPerson)) {
        ctx.addIssue({
          code: "custom",
          message: "Hybrid delivery is not available for this service type.",
          path: ["services", i, "delivery"],
        });
      }
      if (!matchServiceAllowsMultiSessionBilling(line.serviceId) && line.billingUnit === "multi_session") {
        ctx.addIssue({
          code: "custom",
          message: "Multiple-sessions billing is not available for this template.",
          path: ["services", i, "billingUnit"],
        });
      }
      const hasVariations = Boolean(line.variations && line.variations.length > 0);
      if (hasVariations && line.bundleTiers && line.bundleTiers.length > 0) {
        ctx.addIssue({
          code: "custom",
          message:
            "Bundle packs belong on each checkout row when variations exist. Remove these main-offering bundle tiers or delete your extra rows first.",
          path: ["services", i, "bundleTiers"],
        });
      }
      if (hasVariations) {
        const seenV = new Set<string>();
        for (let j = 0; j < (line.variations?.length ?? 0); j++) {
          const v = line.variations![j]!;
          if (seenV.has(v.variationId)) {
            ctx.addIssue({
              code: "custom",
              message: "Each option needs a unique id.",
              path: ["services", i, "variations", j, "variationId"],
            });
            break;
          }
          seenV.add(v.variationId);
          if (!matchServiceAllowsMultiSessionBilling(line.serviceId) && v.billingUnit === "multi_session") {
            ctx.addIssue({
              code: "custom",
              message: "Multiple-sessions billing is not available for this template.",
              path: ["services", i, "variations", j, "billingUnit"],
            });
          }
          if (variationRequiresSessionCount(line.serviceId, v.billingUnit)) {
            const c = v.sessionCount;
            if (c == null || !Number.isFinite(c) || c < 1 || c > 20) {
              ctx.addIssue({
                code: "custom",
                message: "Each per-session or per-person option must include how many sessions (1–20) that price covers.",
                path: ["services", i, "variations", j, "sessionCount"],
              });
            }
          }
          if (serviceOfferingNeedsSessionLength(line.serviceId, line.delivery)) {
            const m = v.sessionMinutes;
            if (m == null || !Number.isFinite(m) || m < TRAINER_SERVICE_SESSION_MINUTES_MIN || m > TRAINER_SERVICE_SESSION_MINUTES_MAX) {
              ctx.addIssue({
                code: "custom",
                message: `Session length is required (${TRAINER_SERVICE_SESSION_MINUTES_MIN}–${TRAINER_SERVICE_SESSION_MINUTES_MAX} minutes) for each option on this template.`,
                path: ["services", i, "variations", j, "sessionMinutes"],
              });
            }
          }
          const seenT = new Set<string>();
          for (let k = 0; k < (v.bundleTiers?.length ?? 0); k++) {
            const t = v.bundleTiers![k]!;
            if (seenT.has(t.tierId)) {
              ctx.addIssue({
                code: "custom",
                message: "Each bundle tier needs a unique id.",
                path: ["services", i, "variations", j, "bundleTiers", k, "tierId"],
              });
              break;
            }
            seenT.add(t.tierId);
          }
        }
      } else {
        if (line.bundleTiers && line.bundleTiers.length > 0) {
          const seenBt = new Set<string>();
          for (let j = 0; j < line.bundleTiers.length; j++) {
            const t = line.bundleTiers[j]!;
            if (seenBt.has(t.tierId)) {
              ctx.addIssue({
                code: "custom",
                message: "Each bundle tier needs a unique id.",
                path: ["services", i, "bundleTiers", j, "tierId"],
              });
              break;
            }
            seenBt.add(t.tierId);
          }
        }
        if (serviceOfferingNeedsSessionLength(line.serviceId, line.delivery)) {
          const m = line.sessionMinutes;
          if (
            m == null ||
            !Number.isFinite(m) ||
            m < TRAINER_SERVICE_SESSION_MINUTES_MIN ||
            m > TRAINER_SERVICE_SESSION_MINUTES_MAX
          ) {
            ctx.addIssue({
              code: "custom",
              message:
                `Session length is required (${TRAINER_SERVICE_SESSION_MINUTES_MIN}–${TRAINER_SERVICE_SESSION_MINUTES_MAX} minutes) for virtual or in-person packages when you use a single list price.`,
              path: ["services", i, "sessionMinutes"],
            });
          }
        }
      }
      const freqKind: SessionFrequencyKind =
        line.sessionFrequencyKind ??
        (line.sessionsPerWeek != null && line.sessionsPerWeek >= 1 ? "per_week" : "none");
      if (freqKind === "per_week") {
        const n = line.sessionFrequencyCount ?? line.sessionsPerWeek;
        if (n == null || n < 1 || n > 14) {
          ctx.addIssue({
            code: "custom",
            message: "Enter sessions per week (1–14) or choose another cadence option.",
            path: ["services", i, "sessionFrequencyCount"],
          });
        }
      }
      if (freqKind === "per_month") {
        const n = line.sessionFrequencyCount;
        if (n == null || n < 1 || n > 31) {
          ctx.addIssue({
            code: "custom",
            message: "Enter sessions per month (1–31).",
            path: ["services", i, "sessionFrequencyCount"],
          });
        }
      }
      if (freqKind === "custom") {
        const c = line.sessionFrequencyCustom?.trim() ?? "";
        if (c.length < 3) {
          ctx.addIssue({
            code: "custom",
            message: "Describe your cadence (at least 3 characters) or pick another option.",
            path: ["services", i, "sessionFrequencyCustom"],
          });
        }
      }
    }
    const needsZip = doc.services.some((s) => s.delivery === "in_person" || s.delivery === "both");
    if (needsZip) {
      const zip = doc.inPersonServiceZip?.trim() ?? "";
      if (!/^\d{5}(-\d{4})?$/.test(zip)) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a valid US ZIP for in-person service coverage.",
          path: ["inPersonServiceZip"],
        });
      }
      const r = doc.inPersonServiceRadiusMiles;
      if (r == null || !Number.isFinite(r) || r < 1 || r > 150) {
        ctx.addIssue({
          code: "custom",
          message: "Enter max drive distance between 1 and 150 miles for in-person coverage.",
          path: ["inPersonServiceRadiusMiles"],
        });
      }
    }
  });

export type TrainerServiceOfferingsDocument = z.infer<typeof trainerServiceOfferingsDocumentSchema>;

/** Title shown to clients (custom `publicTitle` or catalog label). */
export function resolvedTrainerServicePublicTitle(line: Pick<TrainerServiceOfferingLine, "serviceId" | "publicTitle">): string {
  const custom = line.publicTitle?.trim();
  if (custom) return custom;
  return MATCH_SERVICE_CATALOG.find((c) => c.id === line.serviceId)?.label ?? line.serviceId;
}

export function effectiveSessionFrequencyKind(line: TrainerServiceOfferingLine): SessionFrequencyKind {
  if (line.sessionFrequencyKind) return line.sessionFrequencyKind;
  if (line.sessionsPerWeek != null && line.sessionsPerWeek >= 1) return "per_week";
  return "none";
}

/** Short fragment for published profile lines (no leading punctuation). */
export function sessionFrequencyMetaFragment(line: TrainerServiceOfferingLine): string | null {
  const kind = effectiveSessionFrequencyKind(line);
  if (kind === "none") return null;
  if (kind === "per_week") {
    const n = line.sessionFrequencyCount ?? line.sessionsPerWeek;
    if (n == null || n < 1) return null;
    return `${n}×/week`;
  }
  if (kind === "per_month") {
    const n = line.sessionFrequencyCount;
    if (n == null || n < 1) return null;
    return `${n}×/month`;
  }
  if (kind === "custom") {
    const c = line.sessionFrequencyCustom?.trim();
    return c && c.length >= 3 ? c : null;
  }
  return null;
}

export function defaultTrainerServiceOfferingsDocument(): TrainerServiceOfferingsDocument {
  return {
    schemaVersion: 1,
    services: [],
    inPersonServiceZip: null,
    inPersonServiceRadiusMiles: null,
  };
}

/** Legacy rows omitted sessionCount; default to 1 so stored JSON keeps validating. */
function augmentOfferingsSessionCountDefaults(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const doc = parsed as { services?: unknown[] };
  if (!Array.isArray(doc.services)) return parsed;
  return {
    ...doc,
    services: doc.services.map((line: unknown) => {
      if (!line || typeof line !== "object") return line;
      const l = line as { serviceId?: string; variations?: unknown[] };
      if (!Array.isArray(l.variations)) return line;
      const sid = l.serviceId as MatchServiceId | undefined;
      return {
        ...l,
        variations: l.variations.map((v: unknown) => {
          if (!v || typeof v !== "object") return v;
          const row = v as { billingUnit?: BillingUnit; sessionCount?: number };
          if (
            sid &&
            row.billingUnit &&
            variationRequiresSessionCount(sid, row.billingUnit) &&
            (row.sessionCount == null || !Number.isFinite(row.sessionCount))
          ) {
            return { ...row, sessionCount: 1 };
          }
          return v;
        }),
      };
    }),
  };
}

export function parseTrainerServiceOfferingsJson(raw: string | null | undefined): TrainerServiceOfferingsDocument {
  if (!raw?.trim()) return defaultTrainerServiceOfferingsDocument();
  try {
    const json = JSON.parse(raw) as unknown;
    const parsed = trainerServiceOfferingsDocumentSchema.safeParse(augmentOfferingsSessionCountDefaults(json));
    return parsed.success ? parsed.data : defaultTrainerServiceOfferingsDocument();
  } catch {
    return defaultTrainerServiceOfferingsDocument();
  }
}

/** One line for public profile / AI block (no leading “- ”). */
export function formatPublishedOfferingLine(line: TrainerServiceOfferingLine): string {
  const name = resolvedTrainerServicePublicTitle(line);
  const modality =
    line.delivery === "virtual" ? "Virtual" : line.delivery === "in_person" ? "In-Person" : "Virtual and In-Person";
  const meta: string[] = [modality];
  if (line.sessionMinutes != null && line.sessionMinutes > 0) {
    meta.push(`${line.sessionMinutes} min sessions`);
  }
  const freq = sessionFrequencyMetaFragment(line);
  if (freq) meta.push(freq);
  const head = `${name} (${meta.join(" · ")}): ${formatTrainerServicePriceUsd(line.priceUsd)} ${BILLING_UNIT_LABELS[line.billingUnit as BillingUnit]}`;
  const desc = line.description?.trim();
  return desc ? `${head} — ${desc}` : head;
}

export type PublishedPurchaseSku = {
  checkoutKey: string;
  serviceId: MatchServiceId;
  variationId: string | null;
  bundleTierId: string | null;
  bundleQuantity: number;
  label: string;
  priceUsd: number;
  billingUnit: BillingUnit;
  sessionMinutes?: number;
};

/** Flatten a service line into purchasable SKUs (single line, or each variation / bundle tier). */
export function publishedPurchaseSkusFromLine(line: TrainerServiceOfferingLine): PublishedPurchaseSku[] {
  const baseTitle = resolvedTrainerServicePublicTitle(line);
  const modality =
    line.delivery === "virtual" ? "Virtual" : line.delivery === "in_person" ? "In-Person" : "Virtual and In-Person";
  const desc = line.description?.trim();

  if (!line.variations || line.variations.length === 0) {
    const meta: string[] = [modality];
    if (line.sessionMinutes != null && line.sessionMinutes > 0) {
      meta.push(`${line.sessionMinutes} min sessions`);
    }
    const freq = sessionFrequencyMetaFragment(line);
    if (freq) meta.push(freq);
    const head = `${baseTitle} (${meta.join(" · ")}): ${formatTrainerServicePriceUsd(line.priceUsd)} ${BILLING_UNIT_LABELS[line.billingUnit as BillingUnit]}`;
    const label = desc ? `${head} — ${desc}` : head;
    const baseSku: PublishedPurchaseSku = {
      checkoutKey: line.serviceId,
      serviceId: line.serviceId,
      variationId: null,
      bundleTierId: null,
      bundleQuantity: 1,
      label,
      priceUsd: line.priceUsd,
      billingUnit: line.billingUnit,
      sessionMinutes: line.sessionMinutes,
    };
    const out: PublishedPurchaseSku[] = [baseSku];
    const bundleTierBilling: BillingUnit = billingUnitIsCadencePackBase(line.billingUnit as BillingUnit)
      ? (line.billingUnit as BillingUnit)
      : line.billingUnit === "per_person"
        ? "per_person"
        : "multi_session";
    for (const t of line.bundleTiers ?? []) {
      const unitWord = bundleTierQuantityUnitPhrase(line.billingUnit as BillingUnit);
      const tierLabel = t.label?.trim() || `${t.quantity} ${unitWord}`;
      const headT = `${baseTitle} — ${tierLabel}: ${formatTrainerServicePriceUsd(t.priceUsd)} total`;
      const labelT = desc ? `${headT} — ${desc}` : headT;
      out.push({
        checkoutKey: `${line.serviceId}:${t.tierId}`,
        serviceId: line.serviceId,
        variationId: null,
        bundleTierId: t.tierId,
        bundleQuantity: t.quantity,
        label: labelT,
        priceUsd: t.priceUsd,
        billingUnit: bundleTierBilling,
        sessionMinutes: line.sessionMinutes,
      });
    }
    return out;
  }

  const out: PublishedPurchaseSku[] = [];
  const catalogRowTitle =
    MATCH_SERVICE_CATALOG.find((c) => c.id === line.serviceId)?.label ?? line.serviceId;
  for (const v of line.variations) {
    const metaV: string[] = [modality];
    const sessionPackQty = variationRequiresSessionCount(line.serviceId, v.billingUnit)
      ? Math.max(1, Math.min(20, v.sessionCount ?? 1))
      : 1;
    if (variationRequiresSessionCount(line.serviceId, v.billingUnit) && sessionPackQty > 1) {
      metaV.push(`${sessionPackQty} sessions`);
    }
    if (v.sessionMinutes != null && v.sessionMinutes > 0) metaV.push(`${v.sessionMinutes} min`);
    const freq = sessionFrequencyMetaFragment(line);
    if (freq) metaV.push(freq);
    const rowTitle = v.label?.trim() || catalogRowTitle;
    const headV = `${baseTitle} — ${rowTitle} (${metaV.join(" · ")}): ${formatTrainerServicePriceUsd(v.priceUsd)} ${
      BILLING_UNIT_LABELS[v.billingUnit as BillingUnit]
    }`;
    const varDesc = v.variationDescription?.trim();
    const labelBase = [desc ? `${headV} — ${desc}` : headV, varDesc].filter(Boolean).join(" — ");
    out.push({
      checkoutKey: `${line.serviceId}:${v.variationId}`,
      serviceId: line.serviceId,
      variationId: v.variationId,
      bundleTierId: null,
      bundleQuantity: sessionPackQty,
      label: labelBase,
      priceUsd: v.priceUsd,
      billingUnit: v.billingUnit,
      sessionMinutes: v.sessionMinutes,
    });
    const varBundleBilling: BillingUnit = billingUnitIsCadencePackBase(v.billingUnit)
      ? v.billingUnit
      : v.billingUnit === "per_person"
        ? "per_person"
        : "multi_session";
    for (const t of v.bundleTiers ?? []) {
      const unitWord = bundleTierQuantityUnitPhrase(v.billingUnit);
      const tierLabel = t.label?.trim() || `${t.quantity} ${unitWord}`;
      const headT = `${baseTitle} — ${rowTitle} — ${tierLabel}: ${formatTrainerServicePriceUsd(t.priceUsd)} total`;
      const labelT = desc ? `${headT} — ${desc}` : headT;
      out.push({
        checkoutKey: `${line.serviceId}:${v.variationId}:${t.tierId}`,
        serviceId: line.serviceId,
        variationId: v.variationId,
        bundleTierId: t.tierId,
        bundleQuantity: t.quantity,
        label: labelT,
        priceUsd: t.priceUsd,
        billingUnit: varBundleBilling,
        sessionMinutes: v.sessionMinutes,
      });
    }
  }
  return out;
}

/** Builds checkout SKUs from a dashboard / price-check payload (single line or multi-variation). */
export type PriceCheckPublishedSkusPayload = {
  serviceId: MatchServiceId;
  delivery: ServiceDeliveryMode;
  billingUnit: BillingUnit;
  priceUsd: number;
  description: string;
  publicTitle?: string;
  sessionMinutes?: number;
  variations?: TrainerServiceOfferingVariation[];
  sessionFrequencyKind?: SessionFrequencyKind;
  sessionFrequencyCount?: number;
  sessionFrequencyCustom?: string;
  sessionsPerWeek?: number;
};

export function publishedSkusForPriceCheckPayload(p: PriceCheckPublishedSkusPayload): PublishedPurchaseSku[] {
  const desc = p.description.trim();
  const line: TrainerServiceOfferingLine = {
    serviceId: p.serviceId,
    delivery: p.delivery,
    billingUnit: p.billingUnit,
    priceUsd: p.priceUsd,
    description: desc.length > 0 ? desc : "xxxxxxxxxxxxxxxxxxxx",
    ...(p.publicTitle?.trim() ? { publicTitle: p.publicTitle.trim() } : {}),
    ...(p.variations && p.variations.length > 0
      ? { variations: p.variations }
      : p.sessionMinutes != null && Number.isFinite(p.sessionMinutes)
        ? { sessionMinutes: Math.round(p.sessionMinutes) }
        : {}),
  };
  mergeServiceOfferingFrequencyFields(line, {
    sessionFrequencyKind: p.sessionFrequencyKind ?? "none",
    sessionFrequencyCount: p.sessionFrequencyCount,
    sessionFrequencyCustom: p.sessionFrequencyCustom,
    sessionsPerWeek: p.sessionsPerWeek,
  });
  return publishedPurchaseSkusFromLine(line);
}

export function resolveServiceCheckoutSku(
  line: TrainerServiceOfferingLine,
  variationId: string | null | undefined,
  bundleTierId: string | null | undefined,
): { ok: true; sku: PublishedPurchaseSku } | { ok: false; error: string } {
  const skus = publishedPurchaseSkusFromLine(line);
  const vNorm = variationId?.trim() || null;
  const tNorm = bundleTierId?.trim() || null;
  if (!vNorm) {
    if (!tNorm) {
      const d = skus.find((s) => s.variationId == null && s.bundleTierId == null);
      if (!d) return { ok: false, error: "Invalid package selection." };
      return { ok: true, sku: d };
    }
    const hit = skus.find((s) => s.variationId == null && s.bundleTierId === tNorm);
    if (!hit) return { ok: false, error: "That package option is not available." };
    return { ok: true, sku: hit };
  }
  if (tNorm) {
    const hit = skus.find((s) => s.variationId === vNorm && s.bundleTierId === tNorm);
    if (!hit) return { ok: false, error: "That package option is not available." };
    return { ok: true, sku: hit };
  }
  const hit = skus.find((s) => s.variationId === vNorm && !s.bundleTierId);
  if (!hit) return { ok: false, error: "That package option is not available." };
  return { ok: true, sku: hit };
}

/** Lowest list price on a line (for dashboard summary when variations exist). */
export function minListPriceUsdOnLine(line: TrainerServiceOfferingLine): number {
  const skus = publishedPurchaseSkusFromLine(line);
  return Math.min(...skus.map((s) => s.priceUsd));
}

export function coachServiceCheckoutSearch(
  trainerUsername: string,
  sku: { serviceId: string; variationId: string | null; bundleTierId: string | null },
  opts?: { checkoutContext?: "profile" | "chat" },
): string {
  const u = encodeURIComponent(trainerUsername);
  const sid = encodeURIComponent(sku.serviceId);
  let base: string;
  if (!sku.variationId) {
    if (!sku.bundleTierId) {
      base = `trainer=${u}&serviceId=${sid}`;
    } else {
      base = `trainer=${u}&serviceId=${sid}&bundleTierId=${encodeURIComponent(sku.bundleTierId)}`;
    }
  } else {
    const vid = encodeURIComponent(sku.variationId);
    if (!sku.bundleTierId) {
      base = `trainer=${u}&serviceId=${sid}&variationId=${vid}`;
    } else {
      base = `trainer=${u}&serviceId=${sid}&variationId=${vid}&bundleTierId=${encodeURIComponent(sku.bundleTierId)}`;
    }
  }
  if (opts?.checkoutContext === "chat") {
    return `${base}&ctx=chat`;
  }
  return base;
}

export function effectiveSiteVisibility(line: TrainerServiceOfferingLine): "visible" | "hidden" {
  return line.siteVisibility === "hidden" ? "hidden" : "visible";
}

export function effectiveClientBookingAvailability(line: TrainerServiceOfferingLine): "available" | "unavailable" {
  return line.clientBookingAvailability === "unavailable" ? "unavailable" : "available";
}

function formatOptionalAddOnClientSummary(a: TrainerServiceOfferingAddOn): string {
  const title = a.label.trim();
  const bits: string[] = [];
  if (a.priceUsd != null && a.billingUnit) {
    const bill =
      a.billingUnit === "per_hour"
        ? `${formatTrainerServicePriceUsd(a.priceUsd)} per hour`
        : `${formatTrainerServicePriceUsd(a.priceUsd)} per time`;
    bits.push(bill);
  }
  if (a.description?.trim()) bits.push(a.description.trim());
  if (a.coachSummary?.trim()) bits.push(a.coachSummary.trim());
  return bits.length ? `${title} (${bits.join(" · ")})` : title;
}

function augmentSkuLabelsWithAddOns(line: TrainerServiceOfferingLine, skus: PublishedPurchaseSku[]): PublishedPurchaseSku[] {
  const adds = line.optionalAddOns?.filter((a) => a.label.trim().length > 0) ?? [];
  if (adds.length === 0) return skus;
  const suffix = ` — Optional add-ons: ${adds.map((a) => formatOptionalAddOnClientSummary(a)).join("; ")}`;
  return skus.map((sku, idx) => (idx === 0 ? { ...sku, label: `${sku.label}${suffix}` } : sku));
}

export function offeringServicesForPublicProfile(doc: TrainerServiceOfferingsDocument): TrainerServiceOfferingLine[] {
  return doc.services.filter((s) => effectiveSiteVisibility(s) !== "hidden");
}

export function offeringDocumentToDisplayLines(doc: TrainerServiceOfferingsDocument): string[] {
  return offeringServicesForPublicProfile(doc).flatMap((s) =>
    augmentSkuLabelsWithAddOns(s, publishedPurchaseSkusFromLine(s)).map((x) => x.label),
  );
}

export type PublicPurchasableSkuSummary = {
  serviceId: MatchServiceId;
  variationId: string | null;
  bundleTierId: string | null;
  label: string;
};

export function publicPurchasableSkuSummaries(
  doc: TrainerServiceOfferingsDocument,
  allowCheckoutFromPublicProfile: boolean,
): PublicPurchasableSkuSummary[] {
  if (!allowCheckoutFromPublicProfile) return [];
  return publicBrowseableSkuSummaries(doc);
}

/** All client-visible purchasable SKUs (for profile display), independent of profile vs chat checkout policy. */
export function publicBrowseableSkuSummaries(doc: TrainerServiceOfferingsDocument): PublicPurchasableSkuSummary[] {
  return offeringServicesForPublicProfile(doc).flatMap((s) => {
    if (effectiveClientBookingAvailability(s) === "unavailable") return [];
    return augmentSkuLabelsWithAddOns(s, publishedPurchaseSkusFromLine(s)).map((sku) => ({
      serviceId: sku.serviceId,
      variationId: sku.variationId,
      bundleTierId: sku.bundleTierId,
      label: sku.label,
    }));
  });
}

export function composeTrainerAiMatchProfileText(
  questionnaire: TrainerMatchQuestionnairePayload,
  offerings: TrainerServiceOfferingsDocument,
): string {
  const base = buildAiMatchProfileText(questionnaire);
  if (!offerings.services.length) return base;
  const rateLines = offeringServicesForPublicProfile(offerings).flatMap((s) =>
    augmentSkuLabelsWithAddOns(s, publishedPurchaseSkusFromLine(s)).map((sku) => `- ${sku.label}`),
  );
  const block = ["Services and rates:", ...rateLines].join("\n");
  /** After `Session formats:` so `parseAiMatchProfileForDisplay` and human readers see rates before philosophy. */
  const lines = base.split(/\r?\n/);
  let insertAt = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]?.startsWith("Session formats:")) {
      insertAt = i + 1;
      break;
    }
  }
  return [...lines.slice(0, insertAt), "", block, "", ...lines.slice(insertAt)].join("\n");
}

function inferDeliveryForLegacy(
  serviceId: MatchServiceId,
  explicit: ServiceDeliveryMode | undefined,
  offersV: boolean,
  offersI: boolean,
): ServiceDeliveryMode {
  if (explicit === "virtual" || explicit === "in_person" || explicit === "both") return explicit;
  const row = MATCH_SERVICE_CATALOG.find((s) => s.id === serviceId);
  if (!row) return "virtual";
  if (row.virtual && row.inPerson && offersV && offersI) return "both";
  if (row.inPerson && offersI) return "in_person";
  return "virtual";
}

function isLegacyServiceRow(x: unknown): x is Record<string, unknown> {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.serviceId === "string" &&
    typeof o.priceUsd === "number" &&
    Number.isFinite(o.priceUsd) &&
    typeof o.billingUnit === "string"
  );
}

/** Reads questionnaire + offerings; falls back if DB migration for `serviceOfferingsJson` is not applied yet. */
export async function loadTrainerProfileAnswersAndOfferings(trainerId: string): Promise<{
  matchQuestionnaireAnswers: string | null;
  serviceOfferingsJson: string | null;
} | null> {
  try {
    return await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: { matchQuestionnaireAnswers: true, serviceOfferingsJson: true },
    });
  } catch (e) {
    console.error(
      "[Match Fit] trainer_profiles.serviceOfferingsJson unavailable (apply Prisma migrations). Falling back to questionnaire fields only.",
      e,
    );
    try {
      const row = await prisma.trainerProfile.findUnique({
        where: { trainerId },
        select: { matchQuestionnaireAnswers: true },
      });
      if (!row) return null;
      return { matchQuestionnaireAnswers: row.matchQuestionnaireAnswers, serviceOfferingsJson: null };
    } catch (e2) {
      console.error("[Match Fit] Could not read trainer_profiles.", e2);
      return null;
    }
  }
}

/**
 * One-time: move `services` out of legacy `matchQuestionnaireAnswers` into `serviceOfferingsJson`,
 * then strip `services` from stored questionnaire JSON. Rebuilds `aiMatchProfileText` when possible.
 */
export async function migrateLegacyQuestionnaireServices(trainerId: string): Promise<void> {
  const p = await loadTrainerProfileAnswersAndOfferings(trainerId);
  if (!p?.matchQuestionnaireAnswers?.trim()) return;

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(p.matchQuestionnaireAnswers) as Record<string, unknown>;
  } catch {
    return;
  }

  const svc = obj.services;
  if (!Array.isArray(svc) || svc.length === 0) return;

  const existing = parseTrainerServiceOfferingsJson(p.serviceOfferingsJson);
  const offersV = obj.offersVirtual === true;
  const offersI = obj.offersInPerson === true;
  const qZip = typeof obj.inPersonZip === "string" ? obj.inPersonZip.trim() : null;
  const qRadius =
    typeof obj.inPersonRadiusMiles === "number" && Number.isFinite(obj.inPersonRadiusMiles)
      ? Math.floor(obj.inPersonRadiusMiles)
      : null;

  const { services: _removed, ...rest } = obj;

  if (existing.services.length > 0) {
    try {
      await prisma.trainerProfile.update({
        where: { trainerId },
        data: { matchQuestionnaireAnswers: JSON.stringify(rest) },
      });
    } catch (e) {
      console.error("[migrateLegacyQuestionnaireServices] strip legacy services from answers failed", e);
      return;
    }
    await persistTrainerAiMatchProfileText(trainerId);
    return;
  }

  const migrated: TrainerServiceOfferingLine[] = [];
  for (const item of svc) {
    if (!isLegacyServiceRow(item)) continue;
    const o = item;
    const sid = o.serviceId as string;
    if (!MATCH_SERVICE_CATALOG.some((c) => c.id === sid)) continue;
    const serviceId = sid as MatchServiceId;
    const delivery = inferDeliveryForLegacy(
      serviceId,
      o.delivery as ServiceDeliveryMode | undefined,
      offersV,
      offersI,
    );
    const line: TrainerServiceOfferingLine = {
      serviceId,
      priceUsd: o.priceUsd as number,
      billingUnit: o.billingUnit as BillingUnit,
      delivery,
    };
    if (typeof o.description === "string" && o.description.trim()) {
      line.description = o.description.trim().slice(0, 600);
    }
    if (typeof o.sessionMinutes === "number" && Number.isFinite(o.sessionMinutes)) {
      const m = Math.floor(o.sessionMinutes);
      if (m >= TRAINER_SERVICE_SESSION_MINUTES_MIN && m <= TRAINER_SERVICE_SESSION_MINUTES_MAX) line.sessionMinutes = m;
    }
    if (typeof o.sessionsPerWeek === "number" && Number.isFinite(o.sessionsPerWeek)) {
      const w = Math.floor(o.sessionsPerWeek);
      if (w >= 1 && w <= 14) {
        line.sessionsPerWeek = w;
        line.sessionFrequencyKind = "per_week";
        line.sessionFrequencyCount = w;
      }
    }
    migrated.push(line);
  }

  const needsInPersonAnchor = migrated.some((l) => l.delivery === "in_person" || l.delivery === "both");
  const doc: TrainerServiceOfferingsDocument = {
    schemaVersion: 1,
    services: migrated,
    inPersonServiceZip: needsInPersonAnchor ? qZip : null,
    inPersonServiceRadiusMiles: needsInPersonAnchor ? qRadius : null,
  };

  const validated = trainerServiceOfferingsDocumentSchema.safeParse(doc);
  const finalDoc: TrainerServiceOfferingsDocument = validated.success
    ? validated.data
    : {
        schemaVersion: 1,
        services: migrated.map((m) => ({ ...m, delivery: "virtual" as const })),
        inPersonServiceZip: null,
        inPersonServiceRadiusMiles: null,
      };

  try {
    await prisma.trainerProfile.update({
      where: { trainerId },
      data: {
        matchQuestionnaireAnswers: JSON.stringify(rest),
        serviceOfferingsJson: JSON.stringify(finalDoc),
      },
    });
  } catch (e) {
    console.error(
      "[migrateLegacyQuestionnaireServices] Could not write serviceOfferingsJson (run migrations). Stripping legacy services from Onboarding Questionnaire JSON only.",
      e,
    );
    try {
      await prisma.trainerProfile.update({
        where: { trainerId },
        data: { matchQuestionnaireAnswers: JSON.stringify(rest) },
      });
    } catch (e2) {
      console.error("[migrateLegacyQuestionnaireServices] fallback answers-only update failed", e2);
      return;
    }
  }

  await persistTrainerAiMatchProfileText(trainerId);
}

export async function persistTrainerAiMatchProfileText(trainerId: string): Promise<void> {
  try {
    const profile = await loadTrainerProfileAnswersAndOfferings(trainerId);
    if (!profile) return;

    let answers: unknown = null;
    if (profile.matchQuestionnaireAnswers) {
      try {
        answers = JSON.parse(profile.matchQuestionnaireAnswers) as unknown;
      } catch {
        answers = null;
      }
    }
    const draft = parseTrainerMatchQuestionnaireDraft(answers);
    const strict = trainerMatchQuestionnaireSchema.safeParse({ ...draft, certifyAccurate: true as const });
    const offerings = parseTrainerServiceOfferingsJson(profile.serviceOfferingsJson);

    const aiMatchProfileText = strict.success ? composeTrainerAiMatchProfileText(strict.data, offerings) : null;

    await prisma.trainerProfile.update({
      where: { trainerId },
      data: { aiMatchProfileText },
    });
  } catch (e) {
    console.error("[persistTrainerAiMatchProfileText] failed", e);
  }
}

/**
 * Validates `nextDoc`, recomposes `aiMatchProfileText` from the trainer’s completed Onboarding Questionnaire,
 * and persists `serviceOfferingsJson` + `aiMatchProfileText`. Caller must enforce questionnaire completion and gates.
 */
export async function persistTrainerServiceOfferingsWithAi(
  trainerId: string,
  nextDoc: TrainerServiceOfferingsDocument,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const validated = trainerServiceOfferingsDocumentSchema.safeParse(nextDoc);
  if (!validated.success) {
    const msg = validated.error.issues[0]?.message ?? "Could not validate service package.";
    return { ok: false, error: msg, status: 400 };
  }

  const refreshed = await loadTrainerProfileAnswersAndOfferings(trainerId);
  if (!refreshed) {
    return { ok: false, error: "Profile not found.", status: 400 };
  }

  let answers: unknown = null;
  if (refreshed.matchQuestionnaireAnswers) {
    try {
      answers = JSON.parse(refreshed.matchQuestionnaireAnswers) as unknown;
    } catch {
      answers = null;
    }
  }
  const qDraft = parseTrainerMatchQuestionnaireDraft(answers);
  const strictQ = trainerMatchQuestionnaireSchema.safeParse({ ...qDraft, certifyAccurate: true as const });
  if (!strictQ.success) {
    return {
      ok: false,
      error: strictQ.error.issues[0]?.message ?? "Onboarding Questionnaire answers are incomplete.",
      status: 400,
    };
  }

  const aiMatchProfileText = composeTrainerAiMatchProfileText(strictQ.data, validated.data);

  try {
    await prisma.trainerProfile.update({
      where: { trainerId },
      data: {
        serviceOfferingsJson: JSON.stringify(validated.data),
        aiMatchProfileText,
      },
    });
  } catch {
    return {
      ok: false,
      error:
        "Your database is missing the published-services column. From the project root run `npx prisma migrate deploy` (production) or `npx prisma db push` (local), then try again.",
      status: 503,
    };
  }

  return { ok: true };
}
