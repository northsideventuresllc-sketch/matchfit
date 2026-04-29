import { type TrainerMatchQuestionnairePayload, trainerMatchQuestionnaireSchema } from "@/lib/trainer-match-questionnaire";

/** Saved questionnaire JSON may be incomplete until every section passes validation. */
export type TrainerMatchQuestionnaireDraft = {
  schemaVersion: 1;
  offersVirtual: boolean;
  offersInPerson: boolean;
  inPersonZip: string | null;
  inPersonRadiusMiles: number | null;
  ageGroups: TrainerMatchQuestionnairePayload["ageGroups"];
  clientLevels: TrainerMatchQuestionnairePayload["clientLevels"];
  clientGoals: TrainerMatchQuestionnairePayload["clientGoals"];
  languages: TrainerMatchQuestionnairePayload["languages"];
  yearsCoaching: number;
  coachingPhilosophy: string;
  certifyAccurate: boolean;
};

export function defaultTrainerMatchQuestionnaireDraft(): TrainerMatchQuestionnaireDraft {
  return {
    schemaVersion: 1,
    offersVirtual: false,
    offersInPerson: false,
    inPersonZip: null,
    inPersonRadiusMiles: null,
    ageGroups: [],
    clientLevels: [],
    clientGoals: [],
    languages: [],
    yearsCoaching: 0,
    coachingPhilosophy: "",
    certifyAccurate: false,
  };
}

/** Merge stored JSON with safe defaults for missing or invalid fields. Ignores legacy `services` (migrated separately). */
export function parseTrainerMatchQuestionnaireDraft(raw: unknown): TrainerMatchQuestionnaireDraft {
  const d = defaultTrainerMatchQuestionnaireDraft();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return d;
  const o = raw as Record<string, unknown>;

  if (o.schemaVersion === 1) d.schemaVersion = 1;
  if (typeof o.offersVirtual === "boolean") d.offersVirtual = o.offersVirtual;
  if (typeof o.offersInPerson === "boolean") d.offersInPerson = o.offersInPerson;

  if (typeof o.inPersonZip === "string" || o.inPersonZip === null) {
    d.inPersonZip = typeof o.inPersonZip === "string" ? o.inPersonZip : null;
  }
  if (typeof o.inPersonRadiusMiles === "number" && Number.isFinite(o.inPersonRadiusMiles)) {
    d.inPersonRadiusMiles = o.inPersonRadiusMiles;
  } else if (o.inPersonRadiusMiles === null) {
    d.inPersonRadiusMiles = null;
  }

  const copyEnumArray = <T extends readonly string[]>(arr: unknown, allowed: T): T[number][] => {
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is T[number] => typeof x === "string" && (allowed as readonly string[]).includes(x));
  };

  d.ageGroups = copyEnumArray(o.ageGroups, ["18_29", "30_44", "45_54", "55_plus"] as const);
  d.clientLevels = copyEnumArray(o.clientLevels, ["beginners", "intermediate", "advanced"] as const);
  d.clientGoals = copyEnumArray(
    o.clientGoals,
    [
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
    ] as const,
  );
  d.languages = copyEnumArray(o.languages, ["english", "spanish", "french", "portuguese", "mandarin", "other"] as const);

  if (typeof o.yearsCoaching === "number" && Number.isFinite(o.yearsCoaching)) {
    d.yearsCoaching = Math.max(0, Math.min(60, Math.floor(o.yearsCoaching)));
  }
  if (typeof o.coachingPhilosophy === "string") d.coachingPhilosophy = o.coachingPhilosophy;
  if (typeof o.certifyAccurate === "boolean") d.certifyAccurate = o.certifyAccurate;

  return d;
}

/** Validate only the section being saved (1–4). */
export function validateTrainerMatchQuestionnaireStep(d: TrainerMatchQuestionnaireDraft, step: number): string | null {
  if (step === 1) {
    if (!d.offersVirtual && !d.offersInPerson) return "Select at least one session format.";
  }
  if (step === 2) {
    if (!d.offersInPerson) return null;
    const zip = (d.inPersonZip ?? "").trim();
    if (!/^\d{5}(-\d{4})?$/.test(zip)) return "Enter a valid US ZIP for your in-person radius.";
    const r = d.inPersonRadiusMiles;
    if (r == null || !Number.isFinite(r) || r < 1 || r > 150) return "Enter a mile radius between 1 and 150.";
  }
  if (step === 3) {
    if (d.ageGroups.length === 0) return "Select at least one age range.";
    if (d.clientLevels.length === 0) return "Select at least one client experience level.";
    if (d.clientGoals.length === 0) return "Select at least one client goal.";
    if (d.languages.length === 0) return "Select at least one language.";
    if (!Number.isFinite(d.yearsCoaching) || d.yearsCoaching < 0 || d.yearsCoaching > 60) {
      return "Enter years coaching between 0 and 60.";
    }
  }
  if (step === 4) {
    if (d.coachingPhilosophy.trim().length < 80) return "Coaching philosophy must be at least 80 characters.";
    if (!d.certifyAccurate) return "Confirm that your answers are accurate.";
    const parsed = trainerMatchQuestionnaireSchema.safeParse({
      ...d,
      certifyAccurate: true as const,
    });
    if (!parsed.success) return parsed.error.issues[0]?.message ?? "Review your answers.";
  }
  return null;
}
