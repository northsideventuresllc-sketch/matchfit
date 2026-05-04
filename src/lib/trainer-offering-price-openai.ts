import {
  BILLING_UNIT_LABELS,
  MATCH_SERVICE_CATALOG,
  type BillingUnit,
  type MatchServiceId,
  type ServiceDeliveryMode,
} from "@/lib/trainer-match-questionnaire";
import type { OfferingPriceCheckListingContext, PriceCheckResult, PriceVerdict } from "@/lib/trainer-offering-price-suggest";
import { analyzeOfferingPriceBenchmark, roundPriceToStep } from "@/lib/trainer-offering-price-suggest";

type OpenAiShape = {
  verdict?: string;
  suggestedPriceUsd?: number;
  headline?: string;
  detail?: string;
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
          "You help US fitness coaches price virtual and in-person packages. You receive the coach's full listing context: delivery mode, line-level billingUnit (fallback when there are no rows), public title, full client-facing description, session length (minutes when applicable), session cadence fields, for in-person/hybrid the hub ZIP and max drive distance in miles, optional raw variationsJson, and—when the coach uses package options—pricingRowsHuman and purchaseRows: one object per actual checkout row. Each purchaseRows[].billingUnit / billingLabel is authoritative for that row (per session, per hour, per month, or multi_session). For multi_session, listPriceUsd is the TOTAL for bundleQuantity sessions. coachPriceUsd matches the cheapest row’s list price when options exist (see coachPriceNote). Compare the ENTIRE set of rows to typical US consumer retail for those billing types—not template-only and not “everything per session.” Respond with JSON only: verdict (too_low|fair|too_high), suggestedPriceUsd (integer 15-5000; align with internal benchmarks which already reflect mixed billing when purchaseRows exist), headline (max 90 chars), detail (2-5 sentences, plain English; name specific rows or billing types when helpful). Never claim you scraped live competitor sites.",
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
        ? parsed.detail.trim().slice(0, 900)
        : bench.detail;

    return {
      verdict,
      suggestedPriceUsd: suggested,
      headline,
      detail,
      benchmarkLowUsd: bench.benchmarkLowUsd,
      benchmarkMidUsd: bench.benchmarkMidUsd,
      benchmarkHighUsd: bench.benchmarkHighUsd,
      source: "openai",
    };
  } catch {
    return null;
  }
}
