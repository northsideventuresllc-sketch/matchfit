import {
  BILLING_UNIT_LABELS,
  MATCH_SERVICE_CATALOG,
  billingUnitIsCadencePackBase,
  type BillingUnit,
  type MatchServiceId,
  type ServiceDeliveryMode,
} from "@/lib/trainer-match-questionnaire";
import { formatTrainerServicePriceUsd } from "@/lib/trainer-service-price-display";
import type { PublishedPurchaseSku } from "@/lib/trainer-service-offerings";

export type PriceVerdict = "too_low" | "fair" | "too_high";

/** One coach-facing suggestion vs typical market (checklist in AI review modal). */
export type CoachListingRecommendation = {
  id: string;
  /** Plain language; shown next to a checkbox. */
  label: string;
  /** use_suggested_anchor = can apply Match Fit suggested anchor price to your listing in one tap. */
  applyKind: "none" | "use_suggested_anchor";
};

export type PriceCheckResult = {
  verdict: PriceVerdict;
  /** Match Fit suggested list price in USD (15–5000). */
  suggestedPriceUsd: number;
  /** Short title for the modal. */
  headline: string;
  /** Longer guidance for the coach. */
  detail: string;
  /** Short, non-technical summary for the coach (preferred over `detail` in UI). */
  summaryPlain?: string;
  /** Actionable checklist vs market; optional until enrichment runs. */
  recommendations?: CoachListingRecommendation[];
  /** Typical range used for comparison (US virtual / hybrid coaching, approximate 2025 retail). */
  benchmarkLowUsd: number;
  benchmarkMidUsd: number;
  benchmarkHighUsd: number;
  source: "benchmark" | "openai";
  /** True when the coach disabled AI pricing review for this package (benchmarks only). */
  aiDisabled?: boolean;
};

type Band = { low: number; mid: number; high: number };

/** Approximate US consumer market bands by template × billing unit (not legal/financial advice). */
const BENCHMARKS: Record<MatchServiceId, Partial<Record<BillingUnit, Band>>> = {
  one_on_one_pt: {
    per_session: { low: 45, mid: 85, high: 160 },
    per_hour: { low: 70, mid: 120, high: 220 },
    per_month: { low: 280, mid: 520, high: 980 },
  },
  small_group: {
    per_session: { low: 22, mid: 42, high: 85 },
    per_person: { low: 18, mid: 34, high: 72 },
    per_hour: { low: 55, mid: 95, high: 180 },
    per_month: { low: 160, mid: 320, high: 640 },
  },
  nutrition_coaching: {
    per_week: { low: 55, mid: 95, high: 185 },
    twice_weekly: { low: 95, mid: 165, high: 320 },
    per_session: { low: 50, mid: 95, high: 165 },
    per_hour: { low: 75, mid: 125, high: 210 },
    per_month: { low: 199, mid: 349, high: 699 },
  },
  online_program: {
    per_week: { low: 45, mid: 79, high: 155 },
    twice_weekly: { low: 79, mid: 135, high: 260 },
    per_session: { low: 40, mid: 75, high: 140 },
    per_hour: { low: 60, mid: 100, high: 180 },
    per_month: { low: 129, mid: 249, high: 499 },
  },
  sports_specific: {
    per_session: { low: 55, mid: 95, high: 175 },
    per_hour: { low: 80, mid: 135, high: 240 },
    per_month: { low: 320, mid: 560, high: 980 },
  },
  mobility_recovery: {
    per_session: { low: 45, mid: 80, high: 145 },
    per_hour: { low: 70, mid: 115, high: 200 },
    per_month: { low: 260, mid: 480, high: 880 },
  },
  hiit_conditioning: {
    per_session: { low: 40, mid: 75, high: 135 },
    per_hour: { low: 65, mid: 110, high: 195 },
    per_month: { low: 240, mid: 440, high: 820 },
  },
  yoga_pilates_style: {
    per_session: { low: 40, mid: 75, high: 130 },
    per_hour: { low: 60, mid: 105, high: 185 },
    per_month: { low: 220, mid: 400, high: 760 },
  },
};

const DEFAULT_BAND: Band = { low: 40, mid: 75, high: 140 };

export function roundPriceToStep(n: number, step = 5): number {
  const v = Math.round(n / step) * step;
  return Math.min(5000, Math.max(15, v));
}

export function getBenchmarkBand(serviceId: MatchServiceId, billingUnit: BillingUnit): Band {
  const row = BENCHMARKS[serviceId]?.[billingUnit];
  if (row) return row;
  if (billingUnit === "multi_session") {
    const pack = BENCHMARKS[serviceId]?.per_session;
    if (pack) return pack;
  }
  if (billingUnit === "per_person") {
    const slot = BENCHMARKS[serviceId]?.per_session;
    if (slot) return { low: slot.low * 0.82, mid: slot.mid * 0.82, high: slot.high * 0.85 };
  }
  if (billingUnit === "per_week" || billingUnit === "twice_weekly") {
    const mo = BENCHMARKS[serviceId]?.per_month;
    if (mo) {
      if (billingUnit === "per_week") {
        return { low: mo.low / 4.5, mid: mo.mid / 4.5, high: mo.high / 4.5 };
      }
      return { low: mo.low / 2.15, mid: mo.mid / 2.15, high: mo.high / 2.15 };
    }
  }
  const anyUnit = BENCHMARKS[serviceId]?.per_session ?? BENCHMARKS[serviceId]?.per_hour ?? BENCHMARKS[serviceId]?.per_month;
  return anyUnit ?? DEFAULT_BAND;
}

function deliveryPremiumFactor(delivery: ServiceDeliveryMode): number {
  if (delivery === "both") return 1.08;
  if (delivery === "in_person") return 1.05;
  return 1;
}

/** One purchasable row for mixed-billing price checks. */
export type PricingCheckSkuRow = {
  label: string;
  billingUnit: BillingUnit;
  priceUsd: number;
  bundleQuantity: number;
  sessionMinutes?: number;
};

/** Optional listing context so benchmarks and AI are not “template only”. */
export type OfferingPriceCheckListingContext = {
  sessionMinutes?: number;
  /** One of per_week | per_month | custom | none — aligns with dashboard service flow. */
  sessionFrequencyKind?: string;
  sessionFrequencyCount?: number;
  sessionFrequencyCustom?: string;
  /** US ZIP when in-person or hybrid; coarse geography signal only. */
  inPersonZip?: string;
  /** Max drive distance (miles) from ZIP for in-person / hybrid packages. */
  inPersonRadiusMiles?: number;
  /** JSON string: variation rows (labels, prices, bundle tiers) when the coach uses multi-option packages. */
  variationsJson?: string | null;
  /** When false, OpenAI pricing pass is skipped (benchmarks only). */
  priceCheckAiEnabled?: boolean;
  /** Flattened checkout rows (when package options exist) for per-unit benchmarking and AI. */
  pricingCheckSkus?: PricingCheckSkuRow[];
  /** Human-readable checkout rows (preferred over raw JSON for models and copy). */
  pricingRowsHuman?: string | null;
};

function travelLoadMultiplier(delivery: ServiceDeliveryMode, radiusMiles?: number): number {
  if (delivery === "virtual") return 1;
  const r = radiusMiles;
  if (r == null || !Number.isFinite(r) || r < 1) return 1;
  if (r <= 15) return 1;
  return Math.min(1.1, 1 + (r - 15) * 0.00075);
}

function sessionLengthMultiplier(billingUnit: BillingUnit, sessionMinutes?: number): number {
  if (sessionMinutes == null || !Number.isFinite(sessionMinutes)) return 1;
  if (billingUnit === "per_month" || billingUnitIsCadencePackBase(billingUnit)) return 1;
  const delta = sessionMinutes - 60;
  return Math.min(1.1, Math.max(0.94, 1 + delta * 0.0025));
}

function descriptionHeuristicMultiplier(description: string): number {
  const d = description.trim().toLowerCase();
  if (d.length < 35) return 1;
  let m = 1;
  if (
    /\b(elite|olympic|competition|d1\b|division\s*1|professional|vip|executive|concierge|pro\s+athlete|college\s+athlete)\b/.test(
      d,
    )
  ) {
    m *= 1.05;
  }
  if (/\b(group|buddy|semi-?private|small\s+group|class\s+of|partner\s+training)\b/.test(d)) {
    m *= 0.97;
  }
  return Math.min(1.08, Math.max(0.95, m));
}

function listingContextMultiplier(input: OfferingPriceCheckListingContext & { delivery: ServiceDeliveryMode; billingUnit: BillingUnit; description: string }): number {
  const t = travelLoadMultiplier(input.delivery, input.inPersonRadiusMiles);
  const s = sessionLengthMultiplier(input.billingUnit, input.sessionMinutes);
  const q = descriptionHeuristicMultiplier(input.description);
  return Math.min(1.22, Math.max(0.9, deliveryPremiumFactor(input.delivery) * t * s * q));
}

function formatListingContextClauses(ctx: OfferingPriceCheckListingContext, delivery: ServiceDeliveryMode): string[] {
  const parts: string[] = [];
  if (ctx.sessionMinutes != null && Number.isFinite(ctx.sessionMinutes) && ctx.sessionMinutes > 0) {
    parts.push(`${Math.round(ctx.sessionMinutes)}-minute sessions`);
  }
  const k = ctx.sessionFrequencyKind;
  if (k === "per_week" && ctx.sessionFrequencyCount != null && ctx.sessionFrequencyCount >= 1) {
    parts.push(`${ctx.sessionFrequencyCount}×/week cadence`);
  } else if (k === "per_month" && ctx.sessionFrequencyCount != null && ctx.sessionFrequencyCount >= 1) {
    parts.push(`${ctx.sessionFrequencyCount}×/month cadence`);
  } else if (k === "custom" && ctx.sessionFrequencyCustom?.trim()) {
    parts.push(`custom cadence: ${ctx.sessionFrequencyCustom.trim().slice(0, 80)}`);
  }
  if (delivery === "in_person" || delivery === "both") {
    const z = ctx.inPersonZip?.trim();
    const r = ctx.inPersonRadiusMiles;
    if (z) parts.push(`in-person hub ZIP ${z}`);
    if (r != null && Number.isFinite(r)) parts.push(`max drive distance ${Math.round(r)} mi`);
  }
  const prh = ctx.pricingRowsHuman?.trim();
  if (prh && prh.length > 4) {
    parts.push(`checkout rows: ${prh.slice(0, 1200)}${prh.length > 1200 ? "…" : ""}`);
  }
  const vj = ctx.variationsJson?.trim();
  if ((!prh || prh.length < 5) && vj && vj.length > 4) {
    parts.push(`published options (JSON): ${vj.slice(0, 400)}${vj.length > 400 ? "…" : ""}`);
  }
  return parts;
}

/** Readable lines for OpenAI / benchmark detail when SKUs are already flattened. */
export function formatPricingRowsHuman(skus: PublishedPurchaseSku[]): string {
  return skus
    .map((s, i) => {
      const unit = BILLING_UNIT_LABELS[s.billingUnit];
      const mins = s.sessionMinutes != null && s.sessionMinutes > 0 ? ` | ${s.sessionMinutes} min` : "";
      const qty = s.bundleQuantity;
      if (billingUnitIsCadencePackBase(s.billingUnit) && qty > 1) {
        const periodWord =
          s.billingUnit === "per_week" ? "weeks" : s.billingUnit === "twice_weekly" ? "two-week blocks" : "months";
        const eachLabel = s.billingUnit === "per_week" ? "week" : s.billingUnit === "twice_weekly" ? "two-week block" : "month";
        const each = s.priceUsd / qty;
        return `${i + 1}. [${unit}] ${formatTrainerServicePriceUsd(s.priceUsd)} total for ${qty} ${periodWord} (~${formatTrainerServicePriceUsd(each)} per ${eachLabel}) — ${s.label.slice(0, 220)}`;
      }
      if (s.billingUnit === "multi_session" && qty > 1) {
        const each = s.priceUsd / qty;
        return `${i + 1}. [${unit}] ${formatTrainerServicePriceUsd(s.priceUsd)} total for ${qty} sessions (~${formatTrainerServicePriceUsd(each)} / session)${mins} — ${s.label.slice(0, 220)}`;
      }
      if (s.billingUnit === "per_session" && qty > 1) {
        const each = s.priceUsd / qty;
        return `${i + 1}. [${unit}] ${formatTrainerServicePriceUsd(s.priceUsd)} total for ${qty} sessions (~${formatTrainerServicePriceUsd(each)} / session)${mins} — ${s.label.slice(0, 220)}`;
      }
      if (s.billingUnit === "per_person" && qty > 1) {
        const each = s.priceUsd / qty;
        return `${i + 1}. [${unit}] ${formatTrainerServicePriceUsd(s.priceUsd)} total for ${qty} per-person sessions (~${formatTrainerServicePriceUsd(each)} / session / person)${mins} — ${s.label.slice(0, 220)}`;
      }
      if (s.billingUnit === "per_hour" && qty > 1) {
        const each = s.priceUsd / qty;
        return `${i + 1}. [${unit}] ${formatTrainerServicePriceUsd(s.priceUsd)} total for ${qty} hours (~${formatTrainerServicePriceUsd(each)} / hour)${mins} — ${s.label.slice(0, 220)}`;
      }
      return `${i + 1}. [${unit}] ${formatTrainerServicePriceUsd(s.priceUsd)}${mins} — ${s.label.slice(0, 220)}`;
    })
    .join("\n");
}

function benchmarkOneSkuRow(
  serviceId: MatchServiceId,
  delivery: ServiceDeliveryMode,
  description: string,
  ctx: OfferingPriceCheckListingContext,
  sku: PricingCheckSkuRow,
): { verdict: PriceVerdict; low: number; mid: number; high: number; suggested: number; comparePrice: number } {
  const qty = Math.max(1, Math.floor(sku.bundleQuantity));
  const bandUnit: BillingUnit = sku.billingUnit === "multi_session" ? "per_session" : sku.billingUnit;
  const band = getBenchmarkBand(serviceId, bandUnit);
  const f = listingContextMultiplier({
    ...ctx,
    delivery,
    billingUnit: sku.billingUnit,
    sessionMinutes: sku.sessionMinutes ?? ctx.sessionMinutes,
    description,
  });
  let low: number;
  let mid: number;
  let high: number;
  let comparePrice: number;
  const scaleTotalByQty =
    qty > 1 &&
    (billingUnitIsCadencePackBase(sku.billingUnit) ||
      sku.billingUnit === "multi_session" ||
      sku.billingUnit === "per_session" ||
      sku.billingUnit === "per_person" ||
      sku.billingUnit === "per_hour");
  if (scaleTotalByQty) {
    low = roundPriceToStep(band.low * f * qty);
    mid = roundPriceToStep(band.mid * f * qty);
    high = roundPriceToStep(band.high * f * qty);
    comparePrice = sku.priceUsd;
  } else {
    low = roundPriceToStep(band.low * f);
    mid = roundPriceToStep(band.mid * f);
    high = roundPriceToStep(band.high * f);
    comparePrice = sku.priceUsd;
  }
  let verdict: PriceVerdict = "fair";
  if (comparePrice < low * 0.88) verdict = "too_low";
  else if (comparePrice > high * 1.12) verdict = "too_high";
  let suggested = mid;
  if (verdict === "too_low") suggested = roundPriceToStep(Math.min(high * 0.92, Math.max(mid, comparePrice * 1.15)));
  if (verdict === "too_high") suggested = roundPriceToStep(Math.max(low * 1.08, Math.min(mid, comparePrice * 0.92)));
  return { verdict, low, mid, high, suggested, comparePrice };
}

function analyzeOfferingPriceBenchmarkMulti(
  input: {
    serviceId: MatchServiceId;
    billingUnit: BillingUnit;
    delivery: ServiceDeliveryMode;
    priceUsd: number;
    description: string;
    publicTitle?: string;
  } & OfferingPriceCheckListingContext,
): PriceCheckResult {
  const skus = input.pricingCheckSkus!;
  const rows = skus.map((sku) => ({
    sku,
    ...benchmarkOneSkuRow(input.serviceId, input.delivery, input.description, input, sku),
  }));
  let verdict: PriceVerdict = "fair";
  if (rows.some((r) => r.verdict === "too_low")) verdict = "too_low";
  else if (rows.some((r) => r.verdict === "too_high")) verdict = "too_high";

  let floorIdx = 0;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i]!.sku.priceUsd < rows[floorIdx]!.sku.priceUsd) floorIdx = i;
  }
  const suggestedPriceUsd = rows[floorIdx]!.suggested;
  const benchmarkLowUsd = Math.min(...rows.map((r) => r.low));
  const benchmarkHighUsd = Math.max(...rows.map((r) => r.high));
  const benchmarkMidUsd = roundPriceToStep((benchmarkLowUsd + benchmarkHighUsd) / 2);

  const custom = input.publicTitle?.trim();
  const label = custom && custom.length > 0 ? custom : (MATCH_SERVICE_CATALOG.find((s) => s.id === input.serviceId)?.label ?? input.serviceId);
  const distinctUnits = new Set(skus.map((s) => s.billingUnit));
  const mixedBilling = distinctUnits.size > 1;

  const headline =
    verdict === "too_low"
      ? mixedBilling
        ? "Some rows look low vs typical retail for their billing type"
        : "This may be below typical market rates"
      : verdict === "too_high"
        ? mixedBilling
          ? "Some rows look high vs typical retail for their billing type"
          : "This may be above what clients expect for similar offers"
        : mixedBilling
          ? "Your mixed package rows look broadly in range"
          : "Your price looks aligned with typical listings";

  const ctxClauses = formatListingContextClauses(input, input.delivery);
  const ctxSentence =
    ctxClauses.length > 0
      ? ` Your saved package details (${ctxClauses.join("; ")}) widen or narrow the template band slightly—not just the service name.`
      : "";
  const descSnippet = input.description.trim().slice(0, 180);
  const descSentence =
    descSnippet.length >= 40
      ? ` Listing copy (“${descSnippet}${input.description.trim().length > 180 ? "…" : ""}”) still nudges the band slightly.`
      : "";

  const rowHints = rows
    .map((r, i) => {
      const u = BILLING_UNIT_LABELS[r.sku.billingUnit];
      return `Row ${i + 1} (${u}, list ${formatTrainerServicePriceUsd(r.sku.priceUsd)}): ~${formatTrainerServicePriceUsd(r.low)}–${formatTrainerServicePriceUsd(r.high)} vs benchmarks`;
    })
    .slice(0, 6)
    .join(" ");

  const detail =
    verdict === "too_low"
      ? `For “${label}” with multiple published checkout rows, Match Fit compared **each row to the benchmark that matches its billing unit** (per session, per person, per hour, per week, semi-weekly, per month, or prepay bundle totals—not everything as per-session). ${rowHints}${ctxSentence}${descSentence}`
      : verdict === "too_high"
        ? `For “${label}”, at least one checkout row sits above the typical band for how that row is billed. ${rowHints}${ctxSentence}${descSentence}`
        : `For “${label}”, your lowest list row is about ${formatTrainerServicePriceUsd(input.priceUsd)}; benchmarks across the ${skus.length} checkout row(s) look broadly consistent${mixedBilling ? " even with mixed billing units" : ""}. ${rowHints}${ctxSentence}${descSentence}`;

  return {
    verdict,
    suggestedPriceUsd,
    headline,
    detail,
    benchmarkLowUsd,
    benchmarkMidUsd,
    benchmarkHighUsd,
    source: "benchmark",
  };
}

/**
 * Deterministic “market check” when no AI key is configured. In-person / hybrid, travel distance,
 * session length, cadence hints, and description heuristics nudge the band vs template-only defaults.
 */
export function analyzeOfferingPriceBenchmark(
  input: {
    serviceId: MatchServiceId;
    billingUnit: BillingUnit;
    delivery: ServiceDeliveryMode;
    priceUsd: number;
    description: string;
    /** Coach-facing listing title when set; benchmarks still use `serviceId`. */
    publicTitle?: string;
  } & OfferingPriceCheckListingContext,
): PriceCheckResult {
  if (input.pricingCheckSkus && input.pricingCheckSkus.length > 0) {
    return analyzeOfferingPriceBenchmarkMulti(input);
  }
  const band = getBenchmarkBand(input.serviceId, input.billingUnit);
  const f = listingContextMultiplier(input);
  const low = roundPriceToStep(band.low * f);
  const mid = roundPriceToStep(band.mid * f);
  const high = roundPriceToStep(band.high * f);
  const p = input.priceUsd;
  const custom = input.publicTitle?.trim();
  const label = custom && custom.length > 0 ? custom : (MATCH_SERVICE_CATALOG.find((s) => s.id === input.serviceId)?.label ?? input.serviceId);

  let verdict: PriceVerdict = "fair";
  if (p < low * 0.88) verdict = "too_low";
  else if (p > high * 1.12) verdict = "too_high";

  let suggested = mid;
  if (verdict === "too_low") suggested = roundPriceToStep(Math.min(high * 0.92, Math.max(mid, p * 1.15)));
  if (verdict === "too_high") suggested = roundPriceToStep(Math.max(low * 1.08, Math.min(mid, p * 0.92)));

  const headline =
    verdict === "too_low"
      ? "This may be below typical market rates"
      : verdict === "too_high"
        ? "This may be above what clients expect for similar offers"
        : "Your price looks aligned with typical listings";

  const billingPhrase = BILLING_UNIT_LABELS[input.billingUnit];
  const ctxClauses = formatListingContextClauses(input, input.delivery);
  const descSnippet = input.description.trim().slice(0, 220);
  const ctxSentence =
    ctxClauses.length > 0
      ? ` Your saved package details (${ctxClauses.join("; ")}) widen or narrow the template band slightly—not just the service name.`
      : "";
  const descSentence =
    descSnippet.length >= 40
      ? ` The description you wrote (“${descSnippet}${input.description.trim().length > 220 ? "…" : ""}”) is part of how clients judge value—benchmarks lean on it lightly, not as a quote of market data.`
      : "";

  const detail =
    verdict === "too_low"
      ? `For “${label}” billed ${billingPhrase}, many coaches in similar US markets list roughly $${low}–$${high}. Pricing too far below can signal less experience or undervalue your time—you can still keep your number if it is intentional.${ctxSentence}${descSentence}`
      : verdict === "too_high"
        ? `For “${label}” with this billing cadence, comparable packages often fall around $${low}–$${high}. A higher price can work with a very strong offer, but clients may compare you to nearby alternatives.${ctxSentence}${descSentence}`
        : `Based on Match Fit’s internal benchmarks for “${label}” (${billingPhrase}), your $${p} sits near the typical $${low}–$${high} band.${ctxSentence}${descSentence}`;

  return {
    verdict,
    suggestedPriceUsd: suggested,
    headline,
    detail,
    benchmarkLowUsd: low,
    benchmarkMidUsd: mid,
    benchmarkHighUsd: high,
    source: "benchmark",
  };
}

/** Auto-fill price: midpoint of band with delivery + listing context adjustment, rounded. */
export function suggestAutoPriceUsd(
  input: {
    serviceId: MatchServiceId;
    billingUnit: BillingUnit;
    delivery: ServiceDeliveryMode;
    description?: string;
  } & OfferingPriceCheckListingContext,
): number {
  const band = getBenchmarkBand(input.serviceId, input.billingUnit);
  const f = listingContextMultiplier({
    ...input,
    description: input.description ?? "",
  });
  return roundPriceToStep(band.mid * f);
}

function clampPlainSummary(s: string | undefined, max = 280): string | undefined {
  const t = s?.trim();
  if (!t) return undefined;
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function defaultSummaryPlain(result: PriceCheckResult): string {
  const low = formatTrainerServicePriceUsd(result.benchmarkLowUsd);
  const high = formatTrainerServicePriceUsd(result.benchmarkHighUsd);
  if (result.verdict === "too_low") {
    return `Compared with similar coach listings (${low}–${high} is a common band), your price looks on the low side. That can attract deal-seekers—or make people wonder what is included. Change only what feels right for you.`;
  }
  if (result.verdict === "too_high") {
    return `Compared with similar listings (${low}–${high} is a common band), your price reads a bit high. That is fine for a premium offer—just make sure your description shows why you are worth it.`;
  }
  return `Your pricing looks in a healthy range for this type of package (${low}–${high} is a typical band). Small tweaks to copy or options can still help conversions.`;
}

function buildDefaultRecommendations(
  result: PriceCheckResult,
  ctx: { description: string; hasMultipleSkus: boolean },
): CoachListingRecommendation[] {
  const out: CoachListingRecommendation[] = [];
  const sug = formatTrainerServicePriceUsd(result.suggestedPriceUsd);
  if (result.verdict !== "fair") {
    out.push({
      id: "align-list-price",
      label: ctx.hasMultipleSkus
        ? `Bring your checkout prices closer to typical market levels (we suggest scaling toward about ${sug} on your lowest-priced option).`
        : `Set your list price closer to what similar coaches charge (about ${sug} is a reasonable target).`,
      applyKind: "use_suggested_anchor",
    });
  }
  const d = ctx.description.trim();
  if (d.length < 80) {
    out.push({
      id: "expand-description",
      label: "Add a few more sentences to your description so clients understand what they get for the price.",
      applyKind: "none",
    });
  }
  if (result.verdict === "fair" && d.length >= 80) {
    out.push({
      id: "optional-fine-tune",
      label: "Optional: skim your titles and options to make sure the first line a client reads matches how you want to be positioned.",
      applyKind: "none",
    });
  }
  return out;
}

function sanitizeRecommendations(raw: unknown): CoachListingRecommendation[] {
  if (!Array.isArray(raw)) return [];
  const out: CoachListingRecommendation[] = [];
  let anchorUsed = false;
  for (const item of raw) {
    if (out.length >= 10) break;
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" && o.id.trim() ? o.id.trim().slice(0, 64) : "";
    const label = typeof o.label === "string" && o.label.trim() ? o.label.trim().slice(0, 220) : "";
    if (!id || !label) continue;
    let applyKind: CoachListingRecommendation["applyKind"] = "none";
    const k = typeof o.applyKind === "string" ? o.applyKind.trim() : "";
    if (k === "use_suggested_anchor" && !anchorUsed) {
      applyKind = "use_suggested_anchor";
      anchorUsed = true;
    }
    out.push({ id, label, applyKind });
  }
  return out;
}

function ensurePriceAnchorRec(
  result: PriceCheckResult,
  recs: CoachListingRecommendation[],
  ctx: { hasMultipleSkus: boolean },
): CoachListingRecommendation[] {
  if (result.verdict === "fair") return recs;
  if (recs.some((r) => r.applyKind === "use_suggested_anchor")) return recs;
  const sug = formatTrainerServicePriceUsd(result.suggestedPriceUsd);
  const extra: CoachListingRecommendation = {
    id: "align-list-price-fallback",
    label: ctx.hasMultipleSkus
      ? `Adjust checkout prices toward typical market levels (about ${sug} on your lowest option is a starting point).`
      : `Adjust your list price toward typical market levels (about ${sug} is a starting point).`,
    applyKind: "use_suggested_anchor",
  };
  return [extra, ...recs];
}

export type EnrichPriceCheckContext = {
  description: string;
  hasMultipleSkus: boolean;
};

/** Adds coach-friendly summary + checklist; safe to call on benchmark or OpenAI results. */
export function enrichPriceCheckResultForCoachUi(
  result: PriceCheckResult,
  ctx: EnrichPriceCheckContext,
): PriceCheckResult {
  const summaryPlain = clampPlainSummary(result.summaryPlain) ?? defaultSummaryPlain(result);
  let recommendations = sanitizeRecommendations(result.recommendations);
  if (recommendations.length === 0) {
    recommendations = buildDefaultRecommendations(result, ctx);
  } else {
    recommendations = ensurePriceAnchorRec(result, recommendations, ctx);
  }
  return { ...result, summaryPlain, recommendations };
}
