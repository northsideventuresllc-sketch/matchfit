/** Top-level nav target: list of questionnaires (Onboarding Questionnaire + Additional Questionnaires). */
export const TRAINER_MATCH_QUESTIONNAIRES_PATH = "/trainer/dashboard/match-questionnaire";

/** Onboarding Questionnaire — section list then per-section editors. */
export const TRAINER_MATCH_ME_PATH = `${TRAINER_MATCH_QUESTIONNAIRES_PATH}/match-me`;

export function matchMeSectionEditHref(slug: string): string {
  return `${TRAINER_MATCH_ME_PATH}/edit/${slug}`;
}
