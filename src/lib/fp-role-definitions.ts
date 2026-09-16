/**
 * Canonical Match Fit account-role definitions — Fitness Pro, Independent Pro, Elite Pro.
 * Single source of truth (JB, home page overhaul) so every hover/click definition and every
 * role subtitle/description on the home page uses the exact same wording.
 */

export type MatchFitRoleId = "fitness_pro" | "independent_pro" | "elite_pro";

export type MatchFitRoleDefinition = {
  /** Singular display label, e.g. "Fitness Pro". */
  label: string;
  definition: string;
};

export const MATCH_FIT_ROLE_DEFINITIONS: Record<MatchFitRoleId, MatchFitRoleDefinition> = {
  fitness_pro: {
    label: "Fitness Pro",
    definition:
      "Coaches who decide to use Match Fit as a management software to find, connect, manage, and process clients. Best for coaches who are more of an indie coach who is an entrepreneur.",
  },
  independent_pro: {
    label: "Independent Pro",
    definition:
      "Coaches and fitness businesses who decide to use Match Fit as a listing platform to link clients back to their established website/brand. Best for coaches and businesses that are looking for another channel of online exposure to bring in new clients.",
  },
  elite_pro: {
    label: "Elite Pro",
    definition:
      "Coaches and fitness businesses looking to get the best of both worlds in what Fitness Pro status and Independent Pro status offers. Best for coaches and businesses looking to integrate a new management platform into their business while looking to acquire new clients.",
  },
};
