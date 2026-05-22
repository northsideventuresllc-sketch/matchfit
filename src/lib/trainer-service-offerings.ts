import "server-only";

export * from "@/lib/trainer-service-offerings-document";

import { prisma } from "@/lib/prisma";
import { parseTrainerMatchQuestionnaireDraft } from "@/lib/trainer-match-questionnaire-draft";
import {
  MATCH_SERVICE_CATALOG,
  trainerMatchQuestionnaireSchema,
  type BillingUnit,
  type MatchServiceId,
  type ServiceDeliveryMode,
} from "@/lib/trainer-match-questionnaire";
import {
  composeTrainerAiMatchProfileText,
  inferDeliveryForLegacy,
  isLegacyServiceRow,
  parseTrainerServiceOfferingsJson,
  TRAINER_SERVICE_SESSION_MINUTES_MAX,
  TRAINER_SERVICE_SESSION_MINUTES_MIN,
  trainerServiceOfferingsDocumentSchema,
  type TrainerServiceOfferingLine,
  type TrainerServiceOfferingsDocument,
} from "@/lib/trainer-service-offerings-document";

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

  const rest = { ...obj };
  delete rest.services;

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
