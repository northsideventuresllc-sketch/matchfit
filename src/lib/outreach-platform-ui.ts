import type { OutreachPlatform } from "@/lib/outreach-types";

export type OutreachPlatformUiCopy = {
  generateDescription: string;
  progressFootnote: string;
  emptyHint: string;
};

export const OUTREACH_PLATFORM_UI: Record<OutreachPlatform, OutreachPlatformUiCopy> = {
  instagram: {
    generateDescription:
      "AI finds public Instagram profiles of US fitness pros — personal trainers, online coaches, and nutrition coaches. Each lead is verified live (no private pages). Generate outreach copy in Outreach Hub after you save leads.",
    progressFootnote:
      "This can take a minute while AI researches coaches and verifies each Instagram profile is public.",
    emptyHint: "No Instagram leads yet. Generate a batch to find verified US fitness pro profiles.",
  },
  facebook: {
    generateDescription:
      "AI finds active US Facebook pages and trainer-focused groups, then you draft page posts in Outreach Hub after saving leads.",
    progressFootnote:
      "AI is researching Facebook pages and groups where US fitness trainers gather.",
    emptyHint: "No Facebook page leads yet. Generate a batch to find US trainer communities and pages.",
  },
  email: {
    generateDescription:
      "AI finds US personal trainers and online coaches with public contact emails. Draft outreach emails in Outreach Hub after you save leads.",
    progressFootnote:
      "AI is researching US fitness pros with publicly listed trainer or coaching emails.",
    emptyHint: "No trainer email leads yet. Generate a batch to find US fitness pros with public emails.",
  },
};

export function stageLabelForOutreachGenerate(platform: OutreachPlatform, percent: number): string {
  if (percent >= 100) return "Complete";

  if (platform === "instagram") {
    if (percent < 18) return "Starting AI coach discovery…";
    if (percent < 36) return "Finding public US fitness pro profiles…";
    if (percent < 54) return "Verifying Instagram profiles…";
    if (percent < 72) return "Scoring coaching niche fit…";
    if (percent < 88) return "Saving verified leads…";
    return "Almost done…";
  }

  if (platform === "facebook") {
    if (percent < 22) return "Starting Facebook page research…";
    if (percent < 45) return "Finding US trainer pages and groups…";
    if (percent < 68) return "Checking fitness community fit…";
    if (percent < 86) return "Saving verified leads…";
    return "Almost done…";
  }

  if (percent < 22) return "Starting trainer email research…";
  if (percent < 45) return "Finding US fitness pros with public emails…";
  if (percent < 68) return "Validating contact details…";
  if (percent < 86) return "Saving verified leads…";
  return "Almost done…";
}
