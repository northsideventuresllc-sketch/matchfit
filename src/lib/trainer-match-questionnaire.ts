import { z } from "zod";

export const BILLING_UNITS = ["per_session", "per_hour", "per_month"] as const;
export type BillingUnit = (typeof BILLING_UNITS)[number];

/** Services trainers can price; flags show which session formats each can apply to. */
export const MATCH_SERVICE_CATALOG = [
  {
    id: "one_on_one_pt",
    label: "One-on-one personal training",
    virtual: true,
    inPerson: true,
  },
  {
    id: "small_group",
    label: "Small group training (2–8 people)",
    virtual: true,
    inPerson: true,
  },
  {
    id: "nutrition_coaching",
    label: "Nutrition & accountability coaching",
    virtual: true,
    inPerson: false,
  },
  {
    id: "online_program",
    label: "Custom online program / plan design",
    virtual: true,
    inPerson: false,
  },
  {
    id: "sports_specific",
    label: "Sport-specific coaching",
    virtual: true,
    inPerson: true,
  },
  {
    id: "mobility_recovery",
    label: "Mobility & recovery sessions",
    virtual: true,
    inPerson: true,
  },
  {
    id: "hiit_conditioning",
    label: "HIIT & conditioning",
    virtual: true,
    inPerson: true,
  },
  {
    id: "yoga_pilates_style",
    label: "Yoga / Pilates-style movement coaching",
    virtual: true,
    inPerson: true,
  },
] as const;

export type MatchServiceId = (typeof MATCH_SERVICE_CATALOG)[number]["id"];

const matchServiceIdSchema = z
  .string()
  .refine((id): id is MatchServiceId => MATCH_SERVICE_CATALOG.some((s) => s.id === id), "Invalid service.");

export const AGE_GROUP_IDS = ["18_29", "30_44", "45_54", "55_plus"] as const;
export const CLIENT_LEVEL_IDS = ["beginners", "intermediate", "advanced"] as const;
export const CLIENT_GOAL_IDS = [
  "weight_loss",
  "build_strength",
  "muscle_gain",
  "mobility_recovery",
  "general_fitness",
  "sports_performance",
  "nutrition_habits",
  "stress_energy",
  "rehab_return_to_fitness",
  "body_recomposition",
] as const;
export const LANGUAGE_IDS = ["english", "spanish", "french", "portuguese", "mandarin", "other"] as const;

export function serviceAllowedForFormats(
  serviceId: MatchServiceId,
  offersVirtual: boolean,
  offersInPerson: boolean,
): boolean {
  const row = MATCH_SERVICE_CATALOG.find((s) => s.id === serviceId);
  if (!row) return false;
  return (offersVirtual && row.virtual) || (offersInPerson && row.inPerson);
}

const serviceLineSchema = z.object({
  serviceId: matchServiceIdSchema,
  priceUsd: z.number().min(15).max(5000),
  billingUnit: z.enum(BILLING_UNITS),
});

export const trainerMatchQuestionnaireSchema = z
  .object({
    schemaVersion: z.literal(1),
    offersVirtual: z.boolean(),
    offersInPerson: z.boolean(),
    services: z.array(serviceLineSchema).min(1, "Add at least one service with a price."),
    inPersonZip: z.string().trim().max(12).optional().nullable(),
    inPersonRadiusMiles: z.number().int().min(1).max(150).optional().nullable(),
    ageGroups: z.array(z.enum(AGE_GROUP_IDS)).min(1, "Select at least one age range."),
    clientLevels: z.array(z.enum(CLIENT_LEVEL_IDS)).min(1, "Select at least one experience level you coach well."),
    clientGoals: z.array(z.enum(CLIENT_GOAL_IDS)).min(1, "Select at least one client goal you focus on."),
    yearsCoaching: z.number().int().min(0).max(60),
    coachingPhilosophy: z.string().trim().min(80).max(4000),
    languages: z.array(z.enum(LANGUAGE_IDS)).min(1, "Select at least one language."),
    certifyAccurate: z.literal(true),
  })
  .superRefine((data, ctx) => {
    if (!data.offersVirtual && !data.offersInPerson) {
      ctx.addIssue({
        code: "custom",
        message: "Select at least one session format (virtual or in-person).",
        path: ["offersVirtual"],
      });
    }
    if (data.offersInPerson) {
      const zip = data.inPersonZip?.trim() ?? "";
      if (!/^\d{5}(-\d{4})?$/.test(zip)) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a valid US ZIP code (5 digits or ZIP+4) for your in-person service area.",
          path: ["inPersonZip"],
        });
      }
      if (data.inPersonRadiusMiles == null || data.inPersonRadiusMiles < 1) {
        ctx.addIssue({
          code: "custom",
          message: "Enter how many miles from that ZIP you accept in-person clients.",
          path: ["inPersonRadiusMiles"],
        });
      }
    }
    const seen = new Set<string>();
    for (const line of data.services) {
      if (seen.has(line.serviceId)) {
        ctx.addIssue({
          code: "custom",
          message: "Each service type can only appear once.",
          path: ["services"],
        });
        break;
      }
      seen.add(line.serviceId);
      if (!serviceAllowedForFormats(line.serviceId, data.offersVirtual, data.offersInPerson)) {
        ctx.addIssue({
          code: "custom",
          message: `Service “${line.serviceId}” does not match your session formats.`,
          path: ["services"],
        });
      }
    }
  });

export type TrainerMatchQuestionnairePayload = z.infer<typeof trainerMatchQuestionnaireSchema>;

export const AGE_GROUP_LABELS: Record<(typeof AGE_GROUP_IDS)[number], string> = {
  "18_29": "Ages 18–29",
  "30_44": "Ages 30–44",
  "45_54": "Ages 45–54",
  "55_plus": "Ages 55+",
};

export const CLIENT_LEVEL_LABELS: Record<(typeof CLIENT_LEVEL_IDS)[number], string> = {
  beginners: "Beginners / new to structured training",
  intermediate: "Intermediate",
  advanced: "Advanced / experienced athletes",
};

export const CLIENT_GOAL_LABELS: Record<(typeof CLIENT_GOAL_IDS)[number], string> = {
  weight_loss: "Weight loss & body composition",
  build_strength: "Strength & power",
  muscle_gain: "Muscle building (hypertrophy)",
  mobility_recovery: "Mobility, flexibility & recovery",
  general_fitness: "General fitness & conditioning",
  sports_performance: "Sport-specific performance",
  nutrition_habits: "Nutrition & lifestyle habits",
  stress_energy: "Stress, energy & sustainable routines",
  rehab_return_to_fitness: "Return to fitness after time off or injury (non-medical)",
  body_recomposition: "Body recomposition",
};

export const LANGUAGE_LABELS: Record<(typeof LANGUAGE_IDS)[number], string> = {
  english: "English",
  spanish: "Spanish",
  french: "French",
  portuguese: "Portuguese",
  mandarin: "Mandarin",
  other: "Other (note in your bio / philosophy if needed)",
};

export const BILLING_UNIT_LABELS: Record<BillingUnit, string> = {
  per_session: "Per session",
  per_hour: "Per hour",
  per_month: "Per month (ongoing coaching)",
};

/**
 * Single plain-text document for search indexing and AI matching (trainer → clients).
 * Keep in sync with questionnaire schema fields.
 */
export function buildAiMatchProfileText(p: TrainerMatchQuestionnairePayload): string {
  const lines: string[] = [];
  lines.push(`MATCH_FIT_TRAINER_MATCH_PROFILE schemaVersion=${p.schemaVersion}`);
  const formats: string[] = [];
  if (p.offersVirtual) formats.push("Virtual");
  if (p.offersInPerson) formats.push("In-person");
  lines.push(`Session formats: ${formats.join(", ")}`);
  lines.push("Services and rates:");
  for (const line of p.services) {
    const cat = MATCH_SERVICE_CATALOG.find((c) => c.id === line.serviceId);
    const name = cat?.label ?? line.serviceId;
    lines.push(`- ${name}: $${line.priceUsd} ${BILLING_UNIT_LABELS[line.billingUnit]}`);
  }
  if (p.offersInPerson && p.inPersonZip) {
    const miles = p.inPersonRadiusMiles ?? "?";
    lines.push(`In-person coverage: ${miles} mile radius of ${p.inPersonZip}`);
  }
  lines.push(`Years coaching: ${p.yearsCoaching}`);
  lines.push(`Best age ranges: ${p.ageGroups.map((id) => AGE_GROUP_LABELS[id]).join("; ")}`);
  lines.push(`Best client levels: ${p.clientLevels.map((id) => CLIENT_LEVEL_LABELS[id]).join("; ")}`);
  lines.push(`Primary client goals: ${p.clientGoals.map((id) => CLIENT_GOAL_LABELS[id]).join("; ")}`);
  lines.push(`Languages: ${p.languages.map((id) => LANGUAGE_LABELS[id]).join("; ")}`);
  lines.push("");
  lines.push("Coaching philosophy (verbatim):");
  lines.push(p.coachingPhilosophy.trim());
  return lines.join("\n");
}
