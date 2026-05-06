import { z } from "zod";

export const BILLING_UNITS = [
  "per_session",
  "multi_session",
  "per_hour",
  "per_month",
  "per_week",
  "twice_weekly",
  "per_person",
] as const;
export type BillingUnit = (typeof BILLING_UNITS)[number];

/** Bundle math: fixed price × number of cadence periods (same model as monthly). */
export function billingUnitIsCadencePackBase(unit: BillingUnit): boolean {
  return unit === "per_month" || unit === "per_week" || unit === "twice_weekly";
}

/** Coaching sold as recurring weekly / semi-weekly / monthly—not per live session UI. */
export function serviceOfferingCadenceBillingTemplates(serviceId: MatchServiceId): boolean {
  return serviceId === "online_program" || serviceId === "nutrition_coaching";
}

/** Wizard billing choices for the services dashboard (not every `BillingUnit` is selectable). */
export function wizardSelectableBillingUnits(serviceId: MatchServiceId): BillingUnit[] {
  if (serviceOfferingCadenceBillingTemplates(serviceId)) {
    return ["per_week", "twice_weekly", "per_month"];
  }
  const base: BillingUnit[] = ["per_session", "per_hour"];
  if (serviceId === "small_group") {
    return [...base, "per_person"];
  }
  return base;
}

/** How a published package is delivered (set on the dashboard only). */
export const SERVICE_DELIVERY_MODES = ["virtual", "in_person", "both"] as const;
export type ServiceDeliveryMode = (typeof SERVICE_DELIVERY_MODES)[number];

/** Services trainers can list from the dashboard; flags show which delivery modes Match Fit supports per template. */
export const MATCH_SERVICE_CATALOG = [
  {
    id: "one_on_one_pt",
    label: "One-on-One Personal Training",
    virtual: true,
    inPerson: true,
  },
  {
    id: "small_group",
    label: "Small Group Training (2–8 People)",
    virtual: true,
    inPerson: true,
  },
  {
    id: "nutrition_coaching",
    label: "Nutrition and Accountability Coaching",
    virtual: true,
    inPerson: false,
  },
  {
    id: "online_program",
    label: "Custom Online Program / Plan Design",
    virtual: true,
    inPerson: false,
  },
  {
    id: "sports_specific",
    label: "Sport-Specific Coaching",
    virtual: true,
    inPerson: true,
  },
  {
    id: "mobility_recovery",
    label: "Mobility and Recovery Sessions",
    virtual: false,
    inPerson: true,
  },
  {
    id: "hiit_conditioning",
    label: "HIIT and Conditioning",
    virtual: true,
    inPerson: true,
  },
  {
    id: "yoga_pilates_style",
    label: "Yoga / Pilates-Style Movement Coaching",
    virtual: true,
    inPerson: true,
  },
] as const;

export type MatchServiceId = (typeof MATCH_SERVICE_CATALOG)[number]["id"];

/** DIY-style templates skip live-session length and multi-session billing. */
export function serviceOfferingIsDiyTemplate(serviceId: MatchServiceId): boolean {
  return serviceId === "online_program";
}

/** Live session packages need a scheduled length; DIY + cadence program templates omit it in the wizard. */
export function serviceOfferingNeedsSessionLength(
  serviceId: MatchServiceId,
  delivery: ServiceDeliveryMode,
): boolean {
  if (serviceOfferingIsDiyTemplate(serviceId)) return false;
  if (serviceOfferingCadenceBillingTemplates(serviceId)) return false;
  return delivery === "virtual" || delivery === "in_person" || delivery === "both";
}

/** “multiple_sessions” as a selectable line billing unit is for session-pack templates only. */
export function matchServiceAllowsMultiSessionBilling(serviceId: MatchServiceId): boolean {
  return !serviceOfferingIsDiyTemplate(serviceId) && !serviceOfferingCadenceBillingTemplates(serviceId);
}

/** Catalog entries coaches can add from the nutrition path (requires nutrition onboarding track). */
export const MATCH_SERVICE_IDS_NUTRITION_OFFERING: MatchServiceId[] = ["nutrition_coaching", "online_program"];

/** Catalog entries coaches can add from the CPT / training path (requires CPT onboarding track). */
export const MATCH_SERVICE_IDS_PT_OFFERING: MatchServiceId[] = MATCH_SERVICE_CATALOG.filter(
  (s) => s.id !== "nutrition_coaching",
).map((s) => s.id);

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

export const trainerMatchQuestionnaireSchema = z
  .object({
    schemaVersion: z.literal(1),
    offersVirtual: z.boolean(),
    offersInPerson: z.boolean(),
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
  per_session: "Per Session",
  multi_session: "Multiple Sessions (Package)",
  per_hour: "Per Hour",
  per_month: "Per Month",
  per_week: "Per Week",
  twice_weekly: "Semi-weekly (twice per week)",
  per_person: "Per Person",
};

/**
 * Onboarding Questionnaire only (session formats, in-person matching radius, client fit, philosophy).
 * Services and rates are stored separately and merged via `composeTrainerAiMatchProfileText`.
 */
export function buildAiMatchProfileText(p: TrainerMatchQuestionnairePayload): string {
  const lines: string[] = [];
  lines.push(`MATCH_FIT_TRAINER_MATCH_PROFILE schemaVersion=${p.schemaVersion}`);
  const formats: string[] = [];
  if (p.offersVirtual) formats.push("Virtual");
  if (p.offersInPerson) formats.push("In-person");
  lines.push(`Session formats: ${formats.join(", ")}`);
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
