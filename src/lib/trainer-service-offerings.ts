import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  BILLING_UNITS,
  BILLING_UNIT_LABELS,
  MATCH_SERVICE_CATALOG,
  SERVICE_DELIVERY_MODES,
  type BillingUnit,
  type MatchServiceId,
  type ServiceDeliveryMode,
  buildAiMatchProfileText,
  trainerMatchQuestionnaireSchema,
  type TrainerMatchQuestionnairePayload,
} from "@/lib/trainer-match-questionnaire";
import { parseTrainerMatchQuestionnaireDraft } from "@/lib/trainer-match-questionnaire-draft";

const matchServiceIdSchema = z
  .string()
  .refine((id): id is MatchServiceId => MATCH_SERVICE_CATALOG.some((s) => s.id === id), "Invalid service.");

export const trainerServiceOfferingLineSchema = z.object({
  serviceId: matchServiceIdSchema,
  priceUsd: z.number().min(15).max(5000),
  billingUnit: z.enum(BILLING_UNITS),
  description: z.string().trim().max(600).optional(),
  sessionMinutes: z.number().int().min(15).max(240).optional(),
  sessionsPerWeek: z.number().int().min(1).max(14).optional(),
  delivery: z.enum(SERVICE_DELIVERY_MODES),
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
          message: "Enter a mile radius between 1 and 150 for in-person coverage.",
          path: ["inPersonServiceRadiusMiles"],
        });
      }
    }
  });

export type TrainerServiceOfferingsDocument = z.infer<typeof trainerServiceOfferingsDocumentSchema>;

export function defaultTrainerServiceOfferingsDocument(): TrainerServiceOfferingsDocument {
  return {
    schemaVersion: 1,
    services: [],
    inPersonServiceZip: null,
    inPersonServiceRadiusMiles: null,
  };
}

export function parseTrainerServiceOfferingsJson(raw: string | null | undefined): TrainerServiceOfferingsDocument {
  if (!raw?.trim()) return defaultTrainerServiceOfferingsDocument();
  try {
    const parsed = trainerServiceOfferingsDocumentSchema.safeParse(JSON.parse(raw) as unknown);
    return parsed.success ? parsed.data : defaultTrainerServiceOfferingsDocument();
  } catch {
    return defaultTrainerServiceOfferingsDocument();
  }
}

/** One line for public profile / AI block (no leading “- ”). */
export function formatPublishedOfferingLine(line: TrainerServiceOfferingLine): string {
  const cat = MATCH_SERVICE_CATALOG.find((c) => c.id === line.serviceId);
  const name = cat?.label ?? line.serviceId;
  const modality =
    line.delivery === "virtual" ? "Virtual" : line.delivery === "in_person" ? "In-person" : "Virtual & in-person";
  const meta: string[] = [modality];
  if (line.sessionMinutes != null && line.sessionMinutes > 0) {
    meta.push(`${line.sessionMinutes} min sessions`);
  }
  if (line.sessionsPerWeek != null && line.sessionsPerWeek > 0) {
    meta.push(`${line.sessionsPerWeek}×/week`);
  }
  const head = `${name} (${meta.join(" · ")}): $${line.priceUsd} ${BILLING_UNIT_LABELS[line.billingUnit as BillingUnit]}`;
  const desc = line.description?.trim();
  return desc ? `${head} — ${desc}` : head;
}

export function offeringDocumentToDisplayLines(doc: TrainerServiceOfferingsDocument): string[] {
  return doc.services.map((s) => formatPublishedOfferingLine(s));
}

export function composeTrainerAiMatchProfileText(
  questionnaire: TrainerMatchQuestionnairePayload,
  offerings: TrainerServiceOfferingsDocument,
): string {
  const base = buildAiMatchProfileText(questionnaire);
  if (!offerings.services.length) return base;
  const block = ["Services and rates:", ...offerings.services.map((s) => `- ${formatPublishedOfferingLine(s)}`)].join(
    "\n",
  );
  return `${base}\n${block}`;
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
      if (m >= 15 && m <= 240) line.sessionMinutes = m;
    }
    if (typeof o.sessionsPerWeek === "number" && Number.isFinite(o.sessionsPerWeek)) {
      const w = Math.floor(o.sessionsPerWeek);
      if (w >= 1 && w <= 14) line.sessionsPerWeek = w;
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
      "[migrateLegacyQuestionnaireServices] Could not write serviceOfferingsJson (run migrations). Stripping legacy services from Match Me JSON only.",
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
