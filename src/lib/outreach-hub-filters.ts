import type {
  OutreachAutoClassification,
  OutreachHubLead,
  OutreachPlatform,
  OutreachTargetGroup,
} from "@/lib/outreach-types";
import {
  FACEBOOK_OUTREACH_STATUS_OPTIONS,
  OUTREACH_CLASSIFICATION_LABELS,
  OUTREACH_PLATFORMS,
  OUTREACH_STATUS_OPTIONS,
} from "@/lib/outreach-types";

export type OutreachHubPlatformFilter = "all" | OutreachPlatform;

export type OutreachHubFilterState = {
  platform: OutreachHubPlatformFilter;
  status: string;
  classification: OutreachAutoClassification | "all";
  targetGroup: OutreachTargetGroup | "all";
  savedFrom: string;
  savedTo: string;
  search: string;
};

export const DEFAULT_OUTREACH_HUB_FILTERS: OutreachHubFilterState = {
  platform: "all",
  status: "all",
  classification: "all",
  targetGroup: "all",
  savedFrom: "",
  savedTo: "",
  search: "",
};

export const HUB_CLASSIFICATION_FILTER_OPTIONS: {
  id: OutreachHubFilterState["classification"];
  label: string;
}[] = [
  { id: "all", label: "All classifications" },
  { id: "ACTIVE_LEAD", label: OUTREACH_CLASSIFICATION_LABELS.ACTIVE_LEAD },
  { id: "FOLLOW_UP_NEEDED", label: OUTREACH_CLASSIFICATION_LABELS.FOLLOW_UP_NEEDED },
  { id: "STATUS_UNKNOWN", label: OUTREACH_CLASSIFICATION_LABELS.STATUS_UNKNOWN },
  { id: "DEAD_LEAD", label: OUTREACH_CLASSIFICATION_LABELS.DEAD_LEAD },
];

export const HUB_TARGET_GROUP_FILTER_OPTIONS: {
  id: OutreachHubFilterState["targetGroup"];
  label: string;
}[] = [
  { id: "all", label: "All audiences" },
  { id: "ATL_LOCAL", label: "US · earlier leads" },
  { id: "VIRTUAL", label: "US" },
];

export function hubStatusFilterOptions(
  platform: OutreachHubPlatformFilter,
): { id: string; label: string }[] {
  const base = [{ id: "all", label: "All statuses" }];

  if (platform === "facebook") {
    return [...base, ...FACEBOOK_OUTREACH_STATUS_OPTIONS];
  }

  if (platform === "instagram" || platform === "email") {
    return [...base, ...OUTREACH_STATUS_OPTIONS];
  }

  const seen = new Set<string>();
  const merged: { id: string; label: string }[] = [];

  for (const option of [...OUTREACH_STATUS_OPTIONS, ...FACEBOOK_OUTREACH_STATUS_OPTIONS]) {
    if (seen.has(option.id)) continue;
    seen.add(option.id);
    merged.push(option);
  }

  return [...base, ...merged];
}

export function hubLeadSearchText(entry: OutreachHubLead): string {
  const { platform, lead } = entry;

  if (platform === "instagram") {
    const ig = lead as { handle: string; profileUrl: string; niche: string };
    return [ig.handle, ig.profileUrl, ig.niche].join(" ").toLowerCase();
  }

  if (platform === "facebook") {
    const fb = lead as { pageName: string; pageUrl: string; audience: string };
    return [fb.pageName, fb.pageUrl, fb.audience].join(" ").toLowerCase();
  }

  const em = lead as { name: string; email: string; businessName: string };
  return [em.name, em.email, em.businessName].join(" ").toLowerCase();
}

function leadTargetGroup(entry: OutreachHubLead): string | null {
  const lead = entry.lead as { targetGroup?: string };
  return lead.targetGroup ?? null;
}

function leadClassification(entry: OutreachHubLead): string {
  const lead = entry.lead as { autoClassification?: string };
  return lead.autoClassification ?? "STATUS_UNKNOWN";
}

function leadStatus(entry: OutreachHubLead): string {
  const lead = entry.lead as { status?: string };
  return lead.status ?? "LEAD";
}

function parseDateBoundary(value: string, endOfDay: boolean): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(`${trimmed}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function outreachHubFiltersActive(filters: OutreachHubFilterState): boolean {
  return (
    filters.platform !== "all" ||
    filters.status !== "all" ||
    filters.classification !== "all" ||
    filters.targetGroup !== "all" ||
    filters.savedFrom.trim() !== "" ||
    filters.savedTo.trim() !== "" ||
    filters.search.trim() !== ""
  );
}

export function filterOutreachHubLeads(
  entries: OutreachHubLead[],
  filters: OutreachHubFilterState,
): OutreachHubLead[] {
  const search = filters.search.trim().toLowerCase();
  const savedFrom = parseDateBoundary(filters.savedFrom, false);
  const savedTo = parseDateBoundary(filters.savedTo, true);

  return entries.filter((entry) => {
    if (filters.platform !== "all" && entry.platform !== filters.platform) {
      return false;
    }

    if (filters.status !== "all" && leadStatus(entry) !== filters.status) {
      return false;
    }

    if (filters.classification !== "all" && leadClassification(entry) !== filters.classification) {
      return false;
    }

    if (filters.targetGroup !== "all") {
      const group = leadTargetGroup(entry);
      if (!group || group !== filters.targetGroup) {
        return false;
      }
    }

    if (savedFrom || savedTo) {
      const savedAt = new Date(entry.savedToHubAt);
      if (Number.isNaN(savedAt.getTime())) return false;
      if (savedFrom && savedAt < savedFrom) return false;
      if (savedTo && savedAt > savedTo) return false;
    }

    if (search && !hubLeadSearchText(entry).includes(search)) {
      return false;
    }

    return true;
  });
}

export const HUB_PLATFORM_FILTER_OPTIONS: { id: OutreachHubPlatformFilter; label: string }[] = [
  { id: "all", label: "All platforms" },
  ...OUTREACH_PLATFORMS.map((p) => ({ id: p.id as OutreachHubPlatformFilter, label: p.label })),
];
