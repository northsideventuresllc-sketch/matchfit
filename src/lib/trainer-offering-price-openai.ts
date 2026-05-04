import {
  BILLING_UNIT_LABELS,
  MATCH_SERVICE_CATALOG,
  type BillingUnit,
  type MatchServiceId,
  type ServiceDeliveryMode,
} from "@/lib/trainer-match-questionnaire";
import type {
  CoachListingRecommendation,
  OfferingPriceCheckListingContext,
  PriceCheckResult,
  PriceVerdict,
} from "@/lib/trainer-offering-price-suggest";
import { analyzeOfferingPriceBenchmark, roundPriceToStep } from "@/lib/trainer-offering-price-suggest";

type OpenAiShape = {
  verdict?: string;
  suggestedPriceUsd?: number;
  headline?: string;
  detail?: string;
  /** Short, friendly summary for the coach (no jargon). */
  summaryPlain?: string;
  /** Checklist items: { id, label, applyKind: "none" | "use_suggested_anchor" }. */
  recommendations?: unknown[];
};

function coerceVerdict(v: string | undefined): PriceVerdict {
  const t = (v ?? "").toLowerCase();
  if (t === "too_low" || t === "low") return "too_low";
  if (t === "too_high" || t === "high") return "too_high";
  return "fair";
}

/**
 * Optional OpenAI-assisted pricing opinion. Returns null if no key, bad response, or error (caller uses benchmark).
 */
export async function analyzeOfferingPriceOpenAi(
  input: {
    serviceId: MatchServiceId;
    billingUnit: BillingUnit;
    delivery: ServiceDeliveryMode;
    priceUsd: number;
    description: string;
    publicTitle?: string;
  } & OfferingPriceCheckListingContext,
): Promise<(PriceCheckResult & { source: "openai" }) | null> {
  if (input.priceCheckAiEnabled === false) return null;
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const custom = input.publicTitle?.trim();
  const label = custom && custom.length > 0 ? custom : (MATCH_SERVICE_CATALOG.find((s) => s.id === input.serviceId)?.label ?? input.serviceId);
  const bench = analyzeOfferingPriceBenchmark(input);

  const purchaseRows =
    input.pricingCheckSkus?.map((s) => ({
      billingUnit: s.billingUnit,
      billingLabel: BILLING_UNIT_LABELS[s.billingUnit],
      listPriceUsd: s.priceUsd,
      bundleQuantity: s.bundleQuantity,
      sessionMinutes: s.sessionMinutes ?? null,
      label: s.label.slice(0, 500),
    })) ?? null;

  const userPayload = {
    serviceLabel: label,
    serviceId: input.serviceId,
    /** Legacy line-level billing when there are no package options; each checkout row still has its own billingUnit in purchaseRows. */
    billingUnit: input.billingUnit,
    delivery: input.delivery,
    coachPriceUsd: input.priceUsd,
    coachPriceNote:
      input.pricingCheckSkus && input.pricingCheckSkus.length > 0
        ? "coachPriceUsd is the lowest checkout list USD (the profile “From” anchor). Each row in purchaseRows has its own billingUnit (per_session, per_hour, per_month, or multi_session). For multi_session rows, listPriceUsd is the TOTAL for bundleQuantity sessions—not a per-session price."
        : "coachPriceUsd is the coach’s list price for this package at the billingUnit shown.",
    fullDescription: input.description.trim().slice(0, 2000),
    sessionMinutes: input.sessionMinutes ?? null,
    sessionFrequencyKind: input.sessionFrequencyKind ?? null,
    sessionFrequencyCount: input.sessionFrequencyCount ?? null,
    sessionFrequencyCustom: input.sessionFrequencyCustom?.trim().slice(0, 120) ?? null,
    inPersonZip: input.inPersonZip?.trim() ?? null,
    inPersonRadiusMiles: input.inPersonRadiusMiles ?? null,
    variationsJson: input.variationsJson?.trim().slice(0, 6000) ?? null,
    pricingRowsHuman: input.pricingRowsHuman?.trim().slice(0, 8000) ?? null,
    purchaseRows,
    internalBenchmarkLow: bench.benchmarkLowUsd,
    internalBenchmarkMid: bench.benchmarkMidUsd,
    internalBenchmarkHigh: bench.benchmarkHighUsd,
    guidance:
      "Weigh the FULL description, session length, cadence (frequency fields), and for in-person/hybrid the max drive distance (miles from hub ZIP)—not the service template name alone. When purchaseRows or pricingRowsHuman is present, analyze EVERY checkout row: each row’s billingLabel tells whether the list price is per session, per hour, per month, or a multi-session bundle total. Do not assume all rows are per-session. Longer sessions, wider travel, and premium positioning in copy can justify higher prices; group-style language may support lower retail. Anchor suggestedPriceUsd to internal benchmarks (computed per-row for mixed packages) unless the listing clearly warrants a material adjustment.",
  };

  const body = {
    model: process.env.OPENAI_PRICE_MODEL?.trim() || "gpt-4o-mini",
    temperature: 0.35,
    response_format: { type: "json_object" as const },
    messages: [
      {
        role: "system" as const,
        content:
          'You help US fitness coaches review a full service listing (not just price). You receive delivery, billing, title, full description, cadence, travel radius when relevant, and every checkout row when options exist. Compare the whole listing to typical US consumer expectations for those billing types. Respond with JSON only. Fields: verdict (too_low|fair|too_high); suggestedPriceUsd (integer 15–5000; align with internalBenchmarkLow/Mid/High which already reflect mixed billing); headline (max 72 chars, plain English); detail (optional, max 400 chars, technical notes if any); summaryPlain (required, max 220 chars: warm, short, zero jargon—like talking to a coach friend; no "benchmark", "SKU", or "billing unit"); recommendations (array, 3–8 items): each { id: unique_snake_case, label: max 140 chars—one specific change vs "what clients usually see" in plain English, applyKind: "use_suggested_anchor" at most ONCE across the array (only for "nudge list/checkout prices toward suggestedPriceUsd"), otherwise "none" for copy, cadence, clarity, or positioning tips. Never claim you scraped live sites.',
      },
      {
        role: "user" as const,
        content: JSON.stringify(userPayload),
      },
    ],
  };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = raw.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    const parsed = JSON.parse(text) as OpenAiShape;
    const verdict = coerceVerdict(parsed.verdict);
    const suggested = roundPriceToStep(
      typeof parsed.suggestedPriceUsd === "number" && Number.isFinite(parsed.suggestedPriceUsd)
        ? parsed.suggestedPriceUsd
        : bench.suggestedPriceUsd,
    );
    const headline =
      typeof parsed.headline === "string" && parsed.headline.trim()
        ? parsed.headline.trim().slice(0, 120)
        : bench.headline;
    const detail =
      typeof parsed.detail === "string" && parsed.detail.trim()
        ? parsed.detail.trim().slice(0, 400)
        : bench.detail;
    const summaryPlain =
      typeof parsed.summaryPlain === "string" && parsed.summaryPlain.trim()
        ? parsed.summaryPlain.trim().slice(0, 280)
        : undefined;
    const recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : undefined;

    return {
      verdict,
      suggestedPriceUsd: suggested,
      headline,
      detail,
      summaryPlain,
      recommendations: recommendations as CoachListingRecommendation[] | undefined,
      benchmarkLowUsd: bench.benchmarkLowUsd,
      benchmarkMidUsd: bench.benchmarkMidUsd,
      benchmarkHighUsd: bench.benchmarkHighUsd,
      source: "openai",
    };
  } catch {
    return null;
  }
}
