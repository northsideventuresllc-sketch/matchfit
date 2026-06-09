import type { OutreachPlatform } from "@/lib/outreach-types";

export type OutreachPlatformUiCopy = {
  generateDescription: string;
  progressFootnote: string;
  emptyHint: string;
};

export const OUTREACH_PLATFORM_UI: Record<OutreachPlatform, OutreachPlatformUiCopy> = {
  instagram: {
    generateDescription:
      "AI finds public Instagram profiles of fitness pros — personal trainers, online coaches, and nutrition coaches building their brand. Each lead is verified live (no private pages), then gets a personalized DM, comment, and invite tail.",
    progressFootnote:
      "This can take a minute while AI researches coaches and verifies each Instagram profile is public.",
    emptyHint: "No Instagram leads yet. Generate a batch to find verified fitness pro profiles.",
  },
  facebook: {
    generateDescription:
      "AI finds active Facebook pages and trainer-focused groups in the Atlanta fitness space, then drafts a page post introducing Match Fit to personal trainers and coaches.",
    progressFootnote:
      "AI is researching Facebook pages and groups where Atlanta fitness trainers gather.",
    emptyHint: "No Facebook page leads yet. Generate a batch to find trainer communities and pages.",
  },
  email: {
    generateDescription:
      "AI finds independent personal trainers and online coaches with public contact emails, then drafts a personalized outreach email with subject line and Match Fit invite.",
    progressFootnote:
      "AI is researching fitness pros with publicly listed trainer or coaching emails.",
    emptyHint: "No trainer email leads yet. Generate a batch to find fitness pros with public emails.",
  },
  other: {
    generateDescription:
      "AI finds fitness pros on other channels (LinkedIn, X, referrals) and drafts outreach copy with a Match Fit invite tail.",
    progressFootnote: "AI is researching fitness pros on alternate outreach channels.",
    emptyHint: "No other-channel leads yet. Generate a batch to get started.",
  },
};

export function stageLabelForOutreachGenerate(platform: OutreachPlatform, percent: number): string {
  if (percent >= 100) return "Complete";

  if (platform === "instagram") {
    if (percent < 18) return "Starting AI coach discovery…";
    if (percent < 36) return "Finding public fitness pro profiles…";
    if (percent < 54) return "Verifying Instagram profiles…";
    if (percent < 72) return "Scoring coaching niche fit…";
    if (percent < 88) return "Drafting DMs and comments…";
    return "Almost done…";
  }

  if (platform === "facebook") {
    if (percent < 22) return "Starting Facebook page research…";
    if (percent < 45) return "Finding trainer pages and groups…";
    if (percent < 68) return "Checking Atlanta fitness community fit…";
    if (percent < 86) return "Drafting page posts…";
    return "Almost done…";
  }

  if (platform === "email") {
    if (percent < 22) return "Starting trainer email research…";
    if (percent < 45) return "Finding fitness pros with public emails…";
    if (percent < 68) return "Validating contact details…";
    if (percent < 86) return "Drafting personalized emails…";
    return "Almost done…";
  }

  if (percent < 30) return "Starting AI lead research…";
  if (percent < 60) return "Finding fitness pro contacts…";
  if (percent < 85) return "Drafting outreach copy…";
  return "Almost done…";
}
