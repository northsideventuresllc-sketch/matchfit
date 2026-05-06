import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import {
  BILLING_UNITS,
  MATCH_SERVICE_CATALOG,
  MATCH_SERVICE_IDS_NUTRITION_OFFERING,
  type MatchServiceId,
  type ServiceDeliveryMode,
} from "@/lib/trainer-match-questionnaire";
import {
  mergeServiceOfferingFrequencyFields,
  migrateLegacyQuestionnaireServices,
  minListPriceUsdOnLine,
  parseTrainerServiceOfferingsJson,
  persistTrainerServiceOfferingsWithAi,
  resolvedTrainerServicePublicTitle,
  SESSION_FREQUENCY_KINDS,
  TRAINER_SERVICE_SESSION_MINUTES_MAX,
  TRAINER_SERVICE_SESSION_MINUTES_MIN,
  trainerServiceOfferingAddOnSchema,
  trainerServiceOfferingBundleTierSchema,
  trainerServiceOfferingVariationSchema,
  type TrainerServiceOfferingLine,
  type TrainerServiceOfferingsDocument,
} from "@/lib/trainer-service-offerings";
import { trainerPublishedProfilePath } from "@/lib/trainer-public-profile-route";
import { trainerOffersNutritionServices, trainerOffersPersonalTrainingServices } from "@/lib/trainer-service-buckets";

type Ctx = { params: Promise<{ serviceId: string }> };

const mutateBodySchema = z.object({
  publicTitle: z.string().trim().max(80).optional(),
  priceUsd: z.number().min(15).max(5000),
  billingUnit: z.enum(BILLING_UNITS),
  description: z.string().trim().min(20).max(600),
  sessionMinutes: z.number().int().min(TRAINER_SERVICE_SESSION_MINUTES_MIN).max(TRAINER_SERVICE_SESSION_MINUTES_MAX).optional(),
  sessionsPerWeek: z.number().int().min(1).max(14).optional(),
  sessionFrequencyKind: z.enum(SESSION_FREQUENCY_KINDS).default("none"),
  sessionFrequencyCount: z.number().int().min(1).max(31).optional(),
  sessionFrequencyCustom: z.string().trim().max(120).optional(),
  delivery: z.enum(["virtual", "in_person", "both"]),
  inPersonZip: z.string().trim().max(12).optional(),
  inPersonRadiusMiles: z.coerce.number().int().min(1).max(150).optional(),
  variations: z.array(trainerServiceOfferingVariationSchema).max(24).optional(),
  bundleTiers: z.array(trainerServiceOfferingBundleTierSchema).max(8).optional(),
  priceCheckAiEnabled: z.boolean().optional(),
  optionalAddOns: z.array(trainerServiceOfferingAddOnSchema).max(12).optional(),
});

function isMatchServiceId(id: string): id is MatchServiceId {
  return MATCH_SERVICE_CATALOG.some((s) => s.id === id);
}

function assertBucketForService(
  serviceId: MatchServiceId,
  bucket: {
    onboardingTrackCpt: boolean;
    onboardingTrackNutrition: boolean;
    onboardingTrackSpecialist: boolean;
    certificationReviewStatus: string;
    nutritionistCertificationReviewStatus: string;
    specialistCertificationReviewStatus: string;
  },
): { ok: true } | { ok: false; error: string; status: number } {
  const isNutrition = MATCH_SERVICE_IDS_NUTRITION_OFFERING.includes(serviceId);
  if (isNutrition && !trainerOffersNutritionServices(bucket)) {
    return {
      ok: false,
      error: "You cannot edit nutrition offerings until your nutrition credential is approved.",
      status: 403,
    };
  }
  if (!isNutrition && !trainerOffersPersonalTrainingServices(bucket)) {
    return {
      ok: false,
      error: "You cannot edit training offerings until your CPT or specialist credential is approved.",
      status: 403,
    };
  }
  return { ok: true };
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { serviceId: rawId } = await ctx.params;
    const sid = decodeURIComponent(rawId ?? "").trim();
    if (!isMatchServiceId(sid)) {
      return NextResponse.json({ error: "Unknown service type." }, { status: 400 });
    }
    const serviceId: MatchServiceId = sid;

    const json: unknown = await req.json();
    const parsed = mutateBodySchema.safeParse(json);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid request.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const body = parsed.data;

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: {
        username: true,
        profile: {
          select: {
            onboardingTrackCpt: true,
            onboardingTrackNutrition: true,
            onboardingTrackSpecialist: true,
            certificationReviewStatus: true,
            nutritionistCertificationReviewStatus: true,
            specialistCertificationReviewStatus: true,
            matchQuestionnaireStatus: true,
            serviceOfferingsJson: true,
          },
        },
      },
    });
    if (!trainer?.profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 400 });
    }
    const prof = trainer.profile;
    if (prof.matchQuestionnaireStatus !== "completed") {
      return NextResponse.json(
        {
          error:
            "Finish your Onboarding Questionnaire first so clients can understand how you coach. Then manage services from this dashboard.",
        },
        { status: 400 },
      );
    }

    const bucket = {
      onboardingTrackCpt: prof.onboardingTrackCpt,
      onboardingTrackNutrition: prof.onboardingTrackNutrition,
      onboardingTrackSpecialist: prof.onboardingTrackSpecialist,
      certificationReviewStatus: prof.certificationReviewStatus,
      nutritionistCertificationReviewStatus: prof.nutritionistCertificationReviewStatus,
      specialistCertificationReviewStatus: prof.specialistCertificationReviewStatus,
    };
    const gate = assertBucketForService(serviceId, bucket);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    await migrateLegacyQuestionnaireServices(trainerId);

    const doc = parseTrainerServiceOfferingsJson(prof.serviceOfferingsJson ?? null);
    const idx = doc.services.findIndex((s) => s.serviceId === serviceId);
    if (idx < 0) {
      return NextResponse.json({ error: "That service is not on your published list." }, { status: 404 });
    }

    const existing = doc.services[idx]!;
    const nextPublicTitle =
      body.publicTitle !== undefined
        ? body.publicTitle.trim().length > 0
          ? body.publicTitle.trim()
          : undefined
        : existing.publicTitle;

    const updatedLine: TrainerServiceOfferingLine = {
      ...existing,
      serviceId,
      priceUsd: body.priceUsd,
      billingUnit: body.billingUnit,
      description: body.description.trim(),
      delivery: body.delivery as ServiceDeliveryMode,
    };
    if (body.sessionMinutes != null) updatedLine.sessionMinutes = body.sessionMinutes;
    else delete updatedLine.sessionMinutes;
    mergeServiceOfferingFrequencyFields(updatedLine, {
      sessionFrequencyKind: body.sessionFrequencyKind,
      sessionFrequencyCount: body.sessionFrequencyCount,
      sessionFrequencyCustom: body.sessionFrequencyCustom,
      sessionsPerWeek: body.sessionsPerWeek,
    });
    if (nextPublicTitle) updatedLine.publicTitle = nextPublicTitle;
    else delete updatedLine.publicTitle;

    if (body.variations !== undefined) {
      if (body.variations.length === 0) {
        delete updatedLine.variations;
      } else {
        updatedLine.variations = body.variations;
        delete updatedLine.bundleTiers;
      }
    }
    if (body.bundleTiers !== undefined) {
      if (body.bundleTiers.length === 0) delete updatedLine.bundleTiers;
      else if (!updatedLine.variations || updatedLine.variations.length === 0) {
        updatedLine.bundleTiers = body.bundleTiers;
      }
    }
    if (body.priceCheckAiEnabled !== undefined) {
      if (body.priceCheckAiEnabled === false) updatedLine.priceCheckAiEnabled = false;
      else delete updatedLine.priceCheckAiEnabled;
    }
    if (body.optionalAddOns !== undefined) {
      if (body.optionalAddOns.length === 0) delete updatedLine.optionalAddOns;
      else updatedLine.optionalAddOns = body.optionalAddOns;
    }
    if (updatedLine.variations && updatedLine.variations.length > 0) {
      updatedLine.priceUsd = minListPriceUsdOnLine(updatedLine);
    }

    const mergedLines = doc.services.map((s, i) => (i === idx ? updatedLine : s));
    const anyNeedsInPersonAnchor = mergedLines.some((s) => s.delivery === "in_person" || s.delivery === "both");
    const thisLineNeedsZip = body.delivery === "in_person" || body.delivery === "both";
    const zipInput = (body.inPersonZip ?? doc.inPersonServiceZip ?? "").trim();
    const radiusInput = body.inPersonRadiusMiles ?? doc.inPersonServiceRadiusMiles;

    let nextZip: string | null = doc.inPersonServiceZip ?? null;
    let nextRadius: number | null = doc.inPersonServiceRadiusMiles ?? null;
    if (thisLineNeedsZip) {
      nextZip = zipInput || nextZip;
      nextRadius = radiusInput ?? nextRadius;
    }
    if (!anyNeedsInPersonAnchor) {
      nextZip = null;
      nextRadius = null;
    }

    const nextDoc: TrainerServiceOfferingsDocument = {
      schemaVersion: 1,
      services: mergedLines,
      inPersonServiceZip: nextZip,
      inPersonServiceRadiusMiles: nextRadius,
    };

    const persisted = await persistTrainerServiceOfferingsWithAi(trainerId, nextDoc);
    if (!persisted.ok) {
      return NextResponse.json({ error: persisted.error }, { status: persisted.status });
    }

    const profilePath = trainerPublishedProfilePath(trainer.username);
    const label = resolvedTrainerServicePublicTitle(updatedLine);

    await prisma.trainerNotification.create({
      data: {
        trainerId,
        kind: "PLATFORM",
        title: "Service updated",
        body: `“${label}” on your public profile was saved with your latest details.`,
        linkHref: profilePath,
      },
    });

    return NextResponse.json({ ok: true, profilePath, serviceLabel: label });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not update service.", {
      logLabel: "[Match Fit trainer service PATCH]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { serviceId: rawId } = await ctx.params;
    const sid = decodeURIComponent(rawId ?? "").trim();
    if (!isMatchServiceId(sid)) {
      return NextResponse.json({ error: "Unknown service type." }, { status: 400 });
    }
    const serviceId: MatchServiceId = sid;

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: {
        username: true,
        profile: {
          select: {
            onboardingTrackCpt: true,
            onboardingTrackNutrition: true,
            onboardingTrackSpecialist: true,
            certificationReviewStatus: true,
            nutritionistCertificationReviewStatus: true,
            specialistCertificationReviewStatus: true,
            matchQuestionnaireStatus: true,
            serviceOfferingsJson: true,
          },
        },
      },
    });
    if (!trainer?.profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 400 });
    }
    const prof = trainer.profile;
    if (prof.matchQuestionnaireStatus !== "completed") {
      return NextResponse.json(
        { error: "Finish your Onboarding Questionnaire before changing published services." },
        { status: 400 },
      );
    }

    const bucket = {
      onboardingTrackCpt: prof.onboardingTrackCpt,
      onboardingTrackNutrition: prof.onboardingTrackNutrition,
      onboardingTrackSpecialist: prof.onboardingTrackSpecialist,
      certificationReviewStatus: prof.certificationReviewStatus,
      nutritionistCertificationReviewStatus: prof.nutritionistCertificationReviewStatus,
      specialistCertificationReviewStatus: prof.specialistCertificationReviewStatus,
    };
    const gate = assertBucketForService(serviceId, bucket);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    await migrateLegacyQuestionnaireServices(trainerId);

    const doc = parseTrainerServiceOfferingsJson(prof.serviceOfferingsJson ?? null);
    const removedLine = doc.services.find((s) => s.serviceId === serviceId);
    const mergedLines = doc.services.filter((s) => s.serviceId !== serviceId);
    if (mergedLines.length === doc.services.length) {
      return NextResponse.json({ error: "That service is not on your published list." }, { status: 404 });
    }

    const anyNeedsInPersonAnchor = mergedLines.some((s) => s.delivery === "in_person" || s.delivery === "both");
    let nextZip: string | null = doc.inPersonServiceZip ?? null;
    let nextRadius: number | null = doc.inPersonServiceRadiusMiles ?? null;
    if (!anyNeedsInPersonAnchor) {
      nextZip = null;
      nextRadius = null;
    }

    const nextDoc: TrainerServiceOfferingsDocument = {
      schemaVersion: 1,
      services: mergedLines,
      inPersonServiceZip: nextZip,
      inPersonServiceRadiusMiles: nextRadius,
    };

    const persisted = await persistTrainerServiceOfferingsWithAi(trainerId, nextDoc);
    if (!persisted.ok) {
      return NextResponse.json({ error: persisted.error }, { status: persisted.status });
    }

    const profilePath = trainerPublishedProfilePath(trainer.username);
    const label = removedLine ? resolvedTrainerServicePublicTitle(removedLine) : serviceId;

    await prisma.trainerNotification.create({
      data: {
        trainerId,
        kind: "PLATFORM",
        title: "Service removed",
        body: `“${label}” was removed from your public profile.`,
        linkHref: profilePath,
      },
    });

    return NextResponse.json({ ok: true, profilePath, serviceLabel: label });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not remove service.", {
      logLabel: "[Match Fit trainer service DELETE]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
