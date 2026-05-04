import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import {
  BILLING_UNITS,
  MATCH_SERVICE_CATALOG,
  MATCH_SERVICE_IDS_NUTRITION_OFFERING,
  MATCH_SERVICE_IDS_PT_OFFERING,
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
  trainerServiceOfferingVariationSchema,
  type TrainerServiceOfferingLine,
  type TrainerServiceOfferingsDocument,
} from "@/lib/trainer-service-offerings";
import { trainerPublishedProfilePath } from "@/lib/trainer-public-profile-route";
import { trainerOffersNutritionServices, trainerOffersPersonalTrainingServices } from "@/lib/trainer-service-buckets";

const publishBodySchema = z.object({
  offeringKind: z.enum(["nutrition", "personal_training"]),
  serviceId: z.string().trim().min(1),
  publicTitle: z.string().trim().max(80).optional(),
  priceUsd: z.number().min(15).max(5000),
  billingUnit: z.enum(BILLING_UNITS),
  description: z.string().trim().min(20).max(600),
  sessionMinutes: z.number().int().min(15).max(120).optional(),
  sessionsPerWeek: z.number().int().min(1).max(14).optional(),
  sessionFrequencyKind: z.enum(SESSION_FREQUENCY_KINDS).default("none"),
  sessionFrequencyCount: z.number().int().min(1).max(31).optional(),
  sessionFrequencyCustom: z.string().trim().max(120).optional(),
  delivery: z.enum(["virtual", "in_person", "both"]),
  inPersonZip: z.string().trim().max(12).optional(),
  inPersonRadiusMiles: z.coerce.number().int().min(1).max(150).optional(),
  variations: z.array(trainerServiceOfferingVariationSchema).max(24).optional(),
  priceCheckAiEnabled: z.boolean().optional(),
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
    const parsedBody = publishBodySchema.safeParse(json);
    if (!parsedBody.success) {
      const msg = parsedBody.error.issues[0]?.message ?? "Invalid request.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const body = parsedBody.data;

    if (!isMatchServiceId(body.serviceId)) {
      return NextResponse.json({ error: "Unknown service type." }, { status: 400 });
    }
    const serviceId: MatchServiceId = body.serviceId;

    const allowedForKind =
      body.offeringKind === "nutrition"
        ? MATCH_SERVICE_IDS_NUTRITION_OFFERING
        : MATCH_SERVICE_IDS_PT_OFFERING;
    if (!allowedForKind.includes(serviceId)) {
      return NextResponse.json(
        { error: "That service does not match the offering type you selected." },
        { status: 400 },
      );
    }

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
            matchQuestionnaireAnswers: true,
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
            "Finish your Onboarding Questionnaire first so clients can understand how you coach. Then publish services from this dashboard.",
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

    if (body.offeringKind === "nutrition" && !trainerOffersNutritionServices(bucket)) {
      return NextResponse.json(
        {
          error:
            "Nutrition offerings unlock after you select the nutrition path in onboarding and Match Fit approves your nutrition credential.",
        },
        { status: 403 },
      );
    }
    if (body.offeringKind === "personal_training" && !trainerOffersPersonalTrainingServices(bucket)) {
      return NextResponse.json(
        {
          error:
            "Training offerings unlock after CPT or an approved specialist credential (CSCS / CES / group fitness) is on file for your account.",
        },
        { status: 403 },
      );
    }

    await migrateLegacyQuestionnaireServices(trainerId);

    const refreshed = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: { serviceOfferingsJson: true },
    });
    if (!refreshed) {
      return NextResponse.json({ error: "Profile not found." }, { status: 400 });
    }

    const doc = parseTrainerServiceOfferingsJson(refreshed.serviceOfferingsJson ?? null);
    if (doc.services.some((s) => s.serviceId === serviceId)) {
      return NextResponse.json(
        { error: "You already publish this service type. Remove it in the dashboard editor before adding it again." },
        { status: 400 },
      );
    }

    const newLine: TrainerServiceOfferingLine = {
      serviceId,
      priceUsd: body.priceUsd,
      billingUnit: body.billingUnit,
      description: body.description.trim(),
      delivery: body.delivery as ServiceDeliveryMode,
    };
    const pub = body.publicTitle?.trim();
    if (pub) newLine.publicTitle = pub;
    if (body.sessionMinutes != null) newLine.sessionMinutes = body.sessionMinutes;
    mergeServiceOfferingFrequencyFields(newLine, {
      sessionFrequencyKind: body.sessionFrequencyKind,
      sessionFrequencyCount: body.sessionFrequencyCount,
      sessionFrequencyCustom: body.sessionFrequencyCustom,
      sessionsPerWeek: body.sessionsPerWeek,
    });

    if (body.variations && body.variations.length > 0) {
      newLine.variations = body.variations;
      newLine.priceUsd = minListPriceUsdOnLine(newLine);
    }
    if (body.priceCheckAiEnabled === false) {
      newLine.priceCheckAiEnabled = false;
    }

    const mergedLines = [...doc.services, newLine];
    const anyNeedsInPersonAnchor = mergedLines.some(
      (s) => s.delivery === "in_person" || s.delivery === "both",
    );
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
    const label = resolvedTrainerServicePublicTitle(newLine);

    await prisma.trainerNotification.create({
      data: {
        trainerId,
        kind: "PLATFORM",
        title: "Service published",
        body: `“${label}” is live on your public profile with the details you set.`,
        linkHref: profilePath,
      },
    });

    return NextResponse.json({
      ok: true,
      profilePath,
      serviceLabel: label,
    });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not publish service.", {
      logLabel: "[Match Fit trainer publish service]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
