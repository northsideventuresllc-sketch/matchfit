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
  trainerMatchQuestionnaireSchema,
  type MatchServiceId,
  type ServiceDeliveryMode,
} from "@/lib/trainer-match-questionnaire";
import { parseTrainerMatchQuestionnaireDraft } from "@/lib/trainer-match-questionnaire-draft";
import {
  loadTrainerProfileAnswersAndOfferings,
  migrateLegacyQuestionnaireServices,
  parseTrainerServiceOfferingsJson,
  trainerServiceOfferingsDocumentSchema,
  type TrainerServiceOfferingLine,
  type TrainerServiceOfferingsDocument,
  composeTrainerAiMatchProfileText,
} from "@/lib/trainer-service-offerings";
import { trainerPublishedProfilePath } from "@/lib/trainer-public-profile-route";

const publishBodySchema = z.object({
  offeringKind: z.enum(["nutrition", "personal_training"]),
  serviceId: z.string().trim().min(1),
  priceUsd: z.number().min(15).max(5000),
  billingUnit: z.enum(BILLING_UNITS),
  description: z.string().trim().min(20).max(600),
  sessionMinutes: z.number().int().min(15).max(240).optional(),
  sessionsPerWeek: z.number().int().min(1).max(14).optional(),
  delivery: z.enum(["virtual", "in_person", "both"]),
  inPersonZip: z.string().trim().max(12).optional(),
  inPersonRadiusMiles: z.coerce.number().int().min(1).max(150).optional(),
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

    if (body.offeringKind === "nutrition" && !prof.onboardingTrackNutrition) {
      return NextResponse.json(
        { error: "Only coaches on the nutrition track can publish nutrition offerings." },
        { status: 403 },
      );
    }
    if (body.offeringKind === "personal_training" && !prof.onboardingTrackCpt) {
      return NextResponse.json(
        { error: "Only coaches on the CPT track can publish personal training offerings." },
        { status: 403 },
      );
    }

    await migrateLegacyQuestionnaireServices(trainerId);

    const refreshed = await loadTrainerProfileAnswersAndOfferings(trainerId);
    if (!refreshed) {
      return NextResponse.json({ error: "Profile not found." }, { status: 400 });
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
      return NextResponse.json(
        { error: strictQ.error.issues[0]?.message ?? "Onboarding Questionnaire answers are incomplete." },
        { status: 400 },
      );
    }

    let doc = parseTrainerServiceOfferingsJson(refreshed.serviceOfferingsJson ?? null);
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
    if (body.sessionMinutes != null) newLine.sessionMinutes = body.sessionMinutes;
    if (body.sessionsPerWeek != null) newLine.sessionsPerWeek = body.sessionsPerWeek;

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

    const validated = trainerServiceOfferingsDocumentSchema.safeParse(nextDoc);
    if (!validated.success) {
      const msg = validated.error.issues[0]?.message ?? "Could not validate service package.";
      return NextResponse.json({ error: msg, issues: validated.error.issues }, { status: 400 });
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
      return NextResponse.json(
        {
          error:
            "Your database is missing the published-services column. From the project root run `npx prisma migrate deploy` (production) or `npx prisma db push` (local), then try again.",
        },
        { status: 503 },
      );
    }

    const profilePath = trainerPublishedProfilePath(trainer.username);
    const cat = MATCH_SERVICE_CATALOG.find((c) => c.id === serviceId);
    const label = cat?.label ?? serviceId;

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
