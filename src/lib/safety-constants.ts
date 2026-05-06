export const CONVERSATION_RELATIONSHIP_STAGES = [
  "POTENTIAL_CLIENT",
  "LEAD",
  "FIRST_TIME_CLIENT",
  "REGULAR_CLIENT",
  "FORMER_CLIENT",
] as const;

export type ConversationRelationshipStage = (typeof CONVERSATION_RELATIONSHIP_STAGES)[number];

/** Human-readable labels for the relationship stage (chat UI may render options in all caps). */
export const CONVERSATION_RELATIONSHIP_STAGE_LABELS: Record<ConversationRelationshipStage, string> = {
  POTENTIAL_CLIENT: "Potential client",
  LEAD: "Lead",
  FIRST_TIME_CLIENT: "First-time client",
  REGULAR_CLIENT: "Regular client",
  FORMER_CLIENT: "Former client",
};

export function parseConversationRelationshipStage(raw: string | null | undefined): ConversationRelationshipStage {
  const v = (raw ?? "").toUpperCase();
  if (CONVERSATION_RELATIONSHIP_STAGES.includes(v as ConversationRelationshipStage)) {
    return v as ConversationRelationshipStage;
  }
  return "POTENTIAL_CLIENT";
}

export const SAFETY_REPORT_CATEGORIES = [
  "harassment",
  "spam_or_scams",
  "unsafe_conduct",
  "policy_violation",
  "other",
] as const;

export type SafetyReportCategory = (typeof SAFETY_REPORT_CATEGORIES)[number];

export function parseSafetyReportCategory(raw: string | null | undefined): SafetyReportCategory {
  const v = (raw ?? "").toLowerCase();
  if (SAFETY_REPORT_CATEGORIES.includes(v as SafetyReportCategory)) return v as SafetyReportCategory;
  return "other";
}

/** Title-style labels for safety report category dropdowns. */
export function formatSafetyReportCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    harassment: "Harassment",
    spam_or_scams: "Spam or scams",
    unsafe_conduct: "Unsafe conduct",
    policy_violation: "Policy violation",
    other: "Other",
  };
  const key = category.toLowerCase();
  if (map[key]) return map[key];
  return category
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
