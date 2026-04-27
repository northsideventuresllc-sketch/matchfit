export const CONVERSATION_RELATIONSHIP_STAGES = [
  "POTENTIAL_CLIENT",
  "LEAD",
  "FIRST_TIME_CLIENT",
  "REGULAR_CLIENT",
  "FORMER_CLIENT",
] as const;

export type ConversationRelationshipStage = (typeof CONVERSATION_RELATIONSHIP_STAGES)[number];

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
