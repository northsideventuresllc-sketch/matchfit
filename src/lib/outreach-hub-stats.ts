import type { OutreachHubLead, OutreachPlatform } from "@/lib/outreach-types";

export type OutreachHubStatsPlatformFilter = "all" | OutreachPlatform;

export type OutreachHubMetricCounts = {
  all: number;
  instagram: number;
  facebook: number;
  email: number;
};

export type OutreachHubStats = {
  totalInHub: number;
  archived: number;
  activeLeads: OutreachHubMetricCounts;
  followUpNeeded: OutreachHubMetricCounts;
  responses: OutreachHubMetricCounts;
};

/** Facebook page outreach does not use DM-style follow-ups in Outreach HQ stats. */
export const OUTREACH_HUB_FOLLOW_UP_NA_PLATFORMS: OutreachPlatform[] = ["facebook"];

export const OUTREACH_HUB_STAT_PLATFORM_BUTTONS: {
  id: OutreachHubStatsPlatformFilter;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "instagram", label: "Instagram" },
  { id: "email", label: "E-Mail" },
  { id: "facebook", label: "Facebook Pages" },
];

function leadClassification(entry: OutreachHubLead): string {
  const lead = entry.lead as { autoClassification?: string };
  return lead.autoClassification ?? "STATUS_UNKNOWN";
}

function leadStatus(entry: OutreachHubLead): string {
  const lead = entry.lead as { status?: string };
  return lead.status ?? "LEAD";
}

function countByPlatform(
  entries: OutreachHubLead[],
  predicate: (entry: OutreachHubLead) => boolean,
  options?: { excludePlatforms?: OutreachPlatform[] },
): OutreachHubMetricCounts {
  const excluded = new Set(options?.excludePlatforms ?? []);
  const filtered = entries.filter((entry) => !excluded.has(entry.platform) && predicate(entry));

  return {
    all: filtered.length,
    instagram: filtered.filter((entry) => entry.platform === "instagram").length,
    facebook: filtered.filter((entry) => entry.platform === "facebook").length,
    email: filtered.filter((entry) => entry.platform === "email").length,
  };
}

export function computeOutreachHubStats(
  entries: OutreachHubLead[],
  archived = 0,
): OutreachHubStats {
  return {
    totalInHub: entries.length,
    archived,
    activeLeads: countByPlatform(entries, (entry) => leadClassification(entry) === "ACTIVE_LEAD"),
    followUpNeeded: countByPlatform(
      entries,
      (entry) => leadClassification(entry) === "FOLLOW_UP_NEEDED",
      { excludePlatforms: OUTREACH_HUB_FOLLOW_UP_NA_PLATFORMS },
    ),
    responses: countByPlatform(entries, (entry) => leadStatus(entry) === "RESPONSE_RECEIVED"),
  };
}

export function resolveOutreachHubMetricCount(
  counts: OutreachHubMetricCounts,
  platform: OutreachHubStatsPlatformFilter,
): number {
  if (platform === "all") return counts.all;
  return counts[platform];
}

export function isOutreachHubMetricNotApplicable(
  metric: "activeLeads" | "followUpNeeded" | "responses",
  platform: OutreachHubStatsPlatformFilter,
): boolean {
  return metric === "followUpNeeded" && platform === "facebook";
}
