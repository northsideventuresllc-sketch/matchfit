import { MATCH_SERVICE_CATALOG, type BillingUnit, type MatchServiceId, type ServiceDeliveryMode } from "@/lib/trainer-match-questionnaire";
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

  const userPayload = {
    serviceLabel: label,
    serviceId: input.serviceId,
    billingUnit: input.billingUnit,
    delivery: input.delivery,
    coachPriceUsd: input.priceUsd,
    fullDescription: input.description.trim().slice(0, 2000),
    sessionMinutes: input.sessionMinutes ?? null,
    sessionFrequencyKind: input.sessionFrequencyKind ?? null,
    sessionFrequencyCount: input.sessionFrequencyCount ?? null,
    sessionFrequencyCustom: input.sessionFrequencyCustom?.trim().slice(0, 120) ?? null,
    inPersonZip: input.inPersonZip?.trim() ?? null,
    inPersonRadiusMiles: input.inPersonRadiusMiles ?? null,
    variationsJson: input.variationsJson?.trim().slice(0, 6000) ?? null,
    internalBenchmarkLow: bench.benchmarkLowUsd,
    internalBenchmarkMid: bench.benchmarkMidUsd,
    internalBenchmarkHigh: bench.benchmarkHighUsd,
    guidance:
      "Weigh the FULL description, session length, cadence (frequency fields), and for in-person/hybrid the max drive distance (miles from hub ZIP)—not the service template name alone. Longer sessions, wider travel, and premium positioning in copy can justify higher prices; group-style language may support lower retail. Anchor suggestedPriceUsd to internal benchmarks unless the listing clearly warrants a material adjustment.",
  };

  const body = {
    model: process.env.OPENAI_PRICE_MODEL?.trim() || "gpt-4o-mini",
    temperature: 0.35,
    response_format: { type: "json_object" as const },
    messages: [
      {
        role: "system" as const,
        content:
          "You help US fitness coaches price virtual and in-person packages. You receive the coach's full listing context: delivery mode, billing unit, public title, full client-facing description, session length (minutes when applicable), session cadence fields, for in-person/hybrid the hub ZIP and max drive distance in miles, and optionally `variationsJson` describing multiple published price tiers (lengths, per-session vs bundles). Compare their entered `coachPriceUsd` to typical consumer-facing retail for a package with THAT scope—including how multi-tier bundles relate to single-session options—not template-only pricing. Respond with JSON only: verdict (too_low|fair|too_high), suggestedPriceUsd (integer 15-5000; use internalBenchmarkMid as a soft anchor but adjust when description, mileage, session length, cadence, or variation structure clearly warrant it), headline (max 90 chars), detail (2-4 sentences, plain English; reference at least one concrete listing detail when relevant). Never claim you scraped live competitor sites.",
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
