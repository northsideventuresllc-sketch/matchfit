/**
 * FitHub content reporting — categories aligned with common social/community guidelines
 * (safety, health misinformation, harassment, spam, crisis, sensitive media, commerce, IP).
 */
export const FITHUB_CONTENT_REPORT_CATEGORIES = [
  "safety_violation",
  "misinformation_health_fitness",
  "harassment_or_hate",
  "spam_or_scam",
  "self_harm_or_crisis",
  "nudity_or_sexual_content",
  "violence_or_dangerous_acts",
  "illegal_goods_or_services",
  "impersonation_or_ip",
  "other",
] as const;

export type FitHubContentReportCategory = (typeof FITHUB_CONTENT_REPORT_CATEGORIES)[number];

export function parseFitHubContentReportCategory(raw: string | null | undefined): FitHubContentReportCategory {
  const v = (raw ?? "").toLowerCase();
  if (FITHUB_CONTENT_REPORT_CATEGORIES.includes(v as FitHubContentReportCategory)) {
    return v as FitHubContentReportCategory;
  }
  return "other";
}

export const FITHUB_CONTENT_REPORT_CATEGORY_LABELS: Record<FitHubContentReportCategory, string> = {
  safety_violation: "Violates safety or community guidelines",
  misinformation_health_fitness: "Harmful or misleading health / fitness information",
  harassment_or_hate: "Harassment, hate, or targeted abuse",
  spam_or_scam: "Spam, scams, or deceptive promotion",
  self_harm_or_crisis: "Self-harm, suicide, or crisis content",
  nudity_or_sexual_content: "Nudity or sexual content",
  violence_or_dangerous_acts: "Violence, weapons, or dangerous acts",
  illegal_goods_or_services: "Illegal goods, services, or activity",
  impersonation_or_ip: "Impersonation or intellectual property violation",
  other: "Something else",
};
