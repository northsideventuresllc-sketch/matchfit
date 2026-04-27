/** URL segment under `/trainer/dashboard/match-questionnaire/match-me/edit/[slug]`. */
export const MATCH_QUESTIONNAIRE_EDIT_SLUGS = [
  "session-formats",
  "services-pricing",
  "in-person-area",
  "clients-goals",
  "philosophy-confirm",
] as const;

export type MatchQuestionnaireEditSlug = (typeof MATCH_QUESTIONNAIRE_EDIT_SLUGS)[number];

export function slugToStep(slug: string): 1 | 2 | 3 | 4 | 5 | null {
  const i = MATCH_QUESTIONNAIRE_EDIT_SLUGS.indexOf(slug as MatchQuestionnaireEditSlug);
  if (i === -1) return null;
  return (i + 1) as 1 | 2 | 3 | 4 | 5;
}

export function stepToSlug(step: number): MatchQuestionnaireEditSlug | null {
  if (step < 1 || step > 5) return null;
  return MATCH_QUESTIONNAIRE_EDIT_SLUGS[step - 1];
}

/** One Match Me questionnaire — sections are editable parts. Each bubble has its own disclaimer. */
export const MATCH_QUESTIONNAIRE_SECTIONS = [
  {
    slug: "session-formats" as const,
    step: 1 as const,
    title: "Session Formats",
    summary: "Virtual, in-person, or both.",
    disclaimer:
      "Select only formats you actually deliver. Misrepresentation can hurt matches and may violate the trainer agreement.",
  },
  {
    slug: "services-pricing" as const,
    step: 2 as const,
    title: "Services & Pricing",
    summary: "What you sell and how you bill.",
    disclaimer:
      "Prices power search filters and client expectations. Final charges at booking may include platform fees not shown here.",
  },
  {
    slug: "in-person-area" as const,
    step: 3 as const,
    title: "In-Person Service Area",
    summary: "ZIP center point and mile radius.",
    disclaimer:
      "Used for discovery only—not a legal service territory. Exact meeting locations are agreed directly with clients.",
  },
  {
    slug: "clients-goals" as const,
    step: 4 as const,
    title: "Clients & Goals",
    summary: "Ages, levels, goals, languages, experience.",
    disclaimer:
      "Pick combinations you genuinely coach well. Overstating your scope can lead to poor fit and complaints.",
  },
  {
    slug: "philosophy-confirm" as const,
    step: 5 as const,
    title: "Philosophy & Confirmation",
    summary: "Narrative plus accuracy attestation.",
    disclaimer:
      "This narrative may feed search previews and AI matching. Keep it truthful, professional, and updated when your approach changes.",
  },
] as const;

export const FOLLOW_UP_SURVEYS_BLURB =
  "Optional, shorter questionnaires may appear here as our systems learn your specialties. They help keep your profile sharp—none replace the core Match Me sections above.";
