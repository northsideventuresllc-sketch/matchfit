import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionTrainerId } from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { BILLING_UNITS, MATCH_SERVICE_CATALOG, type MatchServiceId, type ServiceDeliveryMode } from "@/lib/trainer-match-questionnaire";
import {
  analyzeOfferingPriceBenchmark,
  formatPricingRowsHuman,
  suggestAutoPriceUsd,
  type PriceCheckResult,
} from "@/lib/trainer-offering-price-suggest";
import { analyzeOfferingPriceOpenAi } from "@/lib/trainer-offering-price-openai";
import {
  SESSION_FREQUENCY_KINDS,
  publishedSkusForPriceCheckPayload,
  trainerServiceOfferingVariationSchema,
} from "@/lib/trainer-service-offerings";

const bodySchema = z.object({
  serviceId: z.string().trim().min(1),
  publicTitle: z.string().trim().max(80).optional(),
  billingUnit: z.enum(BILLING_UNITS),
  delivery: z.enum(["virtual", "in_person", "both"]),
  priceUsd: z.number().min(15).max(5000),
  description: z.string().trim().max(600).optional().default(""),
  sessionMinutes: z.number().int().min(15).max(240).optional(),
  sessionFrequencyKind: z.enum(SESSION_FREQUENCY_KINDS).optional(),
  sessionFrequencyCount: z.number().int().min(1).max(31).optional(),
  sessionFrequencyCustom: z.string().trim().max(120).optional(),
  inPersonZip: z.string().trim().max(12).optional(),
  inPersonRadiusMiles: z.coerce.number().int().min(1).max(150).optional(),
  variations: z.array(trainerServiceOfferingVariationSchema).max(24).optional(),
  priceCheckAiEnabled: z.boolean().optional(),
  mode: z.enum(["full", "auto_only"]).optional().default("full"),
});

function isMatchServiceId(id: string): id is MatchServiceId {
  return MATCH_SERVICE_CATALOG.some((s) => s.id === id);
}

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const json: unknown = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid request.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const body = parsed.data;
    if (!isMatchServiceId(body.serviceId)) {
      return NextResponse.json({ error: "Unknown service type." }, { status: 400 });
    }
    const serviceId = body.serviceId;
    const delivery = body.delivery as ServiceDeliveryMode;

    const variationsJson =
      body.variations && body.variations.length > 0 ? JSON.stringify(body.variations) : undefined;

    const hasPackageOptions = Boolean(body.variations && body.variations.length > 0);
    const skuPayload = {
      serviceId,
      delivery,
      billingUnit: body.billingUnit,
      priceUsd: body.priceUsd,
      description: body.description,
      publicTitle: body.publicTitle,
      sessionMinutes: body.sessionMinutes,
      variations: body.variations,
      sessionFrequencyKind: body.sessionFrequencyKind,
      sessionFrequencyCount: body.sessionFrequencyCount,
      sessionFrequencyCustom: body.sessionFrequencyCustom,
    };
    const flatSkus = publishedSkusForPriceCheckPayload(skuPayload);
    const pricingRowsHuman = hasPackageOptions ? formatPricingRowsHuman(flatSkus) : undefined;
    const pricingCheckSkus = hasPackageOptions
      ? flatSkus.map((s) => ({
          label: s.label.slice(0, 500),
          billingUnit: s.billingUnit,
          priceUsd: s.priceUsd,
          bundleQuantity: s.bundleQuantity,
          sessionMinutes: s.sessionMinutes,
        }))
      : undefined;

    const listingExtras = {
      sessionMinutes: body.sessionMinutes,
      sessionFrequencyKind: body.sessionFrequencyKind,
      sessionFrequencyCount: body.sessionFrequencyCount,
      sessionFrequencyCustom: body.sessionFrequencyCustom,
      inPersonZip: body.inPersonZip?.trim() || undefined,
      inPersonRadiusMiles: body.inPersonRadiusMiles,
      variationsJson,
      priceCheckAiEnabled: body.priceCheckAiEnabled,
      pricingRowsHuman,
      pricingCheckSkus,
    };

    if (body.mode === "auto_only") {
      const suggestedPriceUsd = suggestAutoPriceUsd({
        serviceId,
        billingUnit: body.billingUnit,
        delivery,
        description: body.description,
        ...listingExtras,
      });
      return NextResponse.json({
        suggestedPriceUsd,
        source: "benchmark" as const,
      });
    }

    const customTitle = body.publicTitle?.trim();

    if (body.priceCheckAiEnabled === false) {
      const bench = analyzeOfferingPriceBenchmark({
        serviceId,
        billingUnit: body.billingUnit,
        delivery,
        priceUsd: body.priceUsd,
        description: body.description,
        publicTitle: customTitle && customTitle.length > 0 ? customTitle : undefined,
        ...listingExtras,
      });
      return NextResponse.json({
        ...bench,
        source: "benchmark" as const,
        aiDisabled: true,
        detail:
          `${bench.detail} AI pricing review is turned off for this package—only Match Fit benchmarks are shown. Toggle “AI pricing suggestions” on in Services to get an OpenAI-assisted pass (when configured).`,
      });
    }

    const ai = await analyzeOfferingPriceOpenAi({
      serviceId,
      billingUnit: body.billingUnit,
      delivery,
      priceUsd: body.priceUsd,
      description: body.description,
      publicTitle: customTitle && customTitle.length > 0 ? customTitle : undefined,
      ...listingExtras,
    });
    const result: PriceCheckResult = ai ?? analyzeOfferingPriceBenchmark({
      serviceId,
      billingUnit: body.billingUnit,
      delivery,
      priceUsd: body.priceUsd,
      description: body.description,
      publicTitle: customTitle && customTitle.length > 0 ? customTitle : undefined,
      ...listingExtras,
    });

    return NextResponse.json(result);
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not analyze pricing.", {
      logLabel: "[Match Fit trainer service price check]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
