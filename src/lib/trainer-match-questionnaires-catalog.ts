import { FOLLOW_UP_SURVEYS_BLURB } from "@/lib/trainer-match-questionnaire-section-meta";
import { TRAINER_MATCH_ME_PATH } from "@/lib/trainer-match-questionnaires-routes";

export type TrainerQuestionnaireCatalogEntry = {
  key: string;
  title: string;
  href: string | null;
  summary: string;
  disclaimer: string;
  badge: string | null;
};

/** Cards on the Daily Questionnaires overview (each item is its own questionnaire). */
export const TRAINER_QUESTIONNAIRES_CATALOG: readonly TrainerQuestionnaireCatalogEntry[] = [
  {
    key: "match-me",
    title: "Onboarding Questionnaire",
    href: TRAINER_MATCH_ME_PATH,
    summary:
      "Session format preferences, in-person matching area, who you coach best, and your philosophy, used for discovery and AI matching. Services and rates are managed from your dashboard.",
    disclaimer:
      "This is required for your account to be shown to clients until every part is complete. Saving any section returns you to your dashboard. Additional questionnaires may appear later; they never replace this onboarding flow.",
    badge: "REQUIRED FOR CLIENT VISIBILITY",
  },
  {
    key: "follow-up",
    title: "Additional Questionnaires",
    href: null,
    summary: "Short, targeted surveys as our systems learn more about what you specialize in.",
    disclaimer: FOLLOW_UP_SURVEYS_BLURB,
    badge: "Optional · over time",
  },
] as const;
