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

/** Cards on the Match questionnaires overview (each item is its own questionnaire). */
export const TRAINER_QUESTIONNAIRES_CATALOG: readonly TrainerQuestionnaireCatalogEntry[] = [
  {
    key: "match-me",
    title: "Match Me",
    href: TRAINER_MATCH_ME_PATH,
    summary:
      "Session formats, services and rates, in-person area, who you coach best, and your philosophy—everything we use for client search and AI matching.",
    disclaimer:
      "This is required for your account to be shown to clients until every part is complete. Saving any section returns you to your dashboard. Optional follow-up surveys may appear later; they never replace Match Me.",
    badge: "Required for client visibility",
  },
  {
    key: "follow-up",
    title: "Follow-Up Questionnaires",
    href: null,
    summary: "Short, targeted surveys as our systems learn more about what you specialize in.",
    disclaimer: FOLLOW_UP_SURVEYS_BLURB,
    badge: "Optional · coming soon",
  },
] as const;
