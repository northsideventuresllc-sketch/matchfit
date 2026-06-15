import { describe, expect, it } from "vitest";
import type { OutreachHubLead } from "@/lib/outreach-types";
import {
  DEFAULT_OUTREACH_HUB_FILTERS,
  filterOutreachHubLeads,
  hubLeadSearchText,
  hubStatusFilterOptions,
  outreachHubFiltersActive,
} from "@/lib/outreach-hub-filters";

function igEntry(overrides: Partial<Record<string, unknown>> = {}): OutreachHubLead {
  return {
    platform: "instagram",
    savedToHubAt: "2026-06-10T12:00:00.000Z",
    lead: {
      id: "ig-1",
      handle: "@fitcoach",
      profileUrl: "https://instagram.com/fitcoach",
      niche: "strength",
      targetGroup: "ATL_LOCAL",
      status: "LEAD",
      autoClassification: "ACTIVE_LEAD",
      ...overrides,
    } as OutreachHubLead["lead"],
  };
}

function fbEntry(overrides: Partial<Record<string, unknown>> = {}): OutreachHubLead {
  return {
    platform: "facebook",
    savedToHubAt: "2026-06-05T12:00:00.000Z",
    lead: {
      id: "fb-1",
      pageName: "Atlanta Fitness Group",
      pageUrl: "https://facebook.com/groups/atlfit",
      audience: "trainers",
      targetGroup: "VIRTUAL",
      status: "GROUP_JOINED",
      autoClassification: "FOLLOW_UP_NEEDED",
      ...overrides,
    } as OutreachHubLead["lead"],
  };
}

describe("outreach hub filters", () => {
  it("returns all entries with default filters", () => {
    const entries = [igEntry(), fbEntry()];
    expect(filterOutreachHubLeads(entries, DEFAULT_OUTREACH_HUB_FILTERS)).toHaveLength(2);
    expect(outreachHubFiltersActive(DEFAULT_OUTREACH_HUB_FILTERS)).toBe(false);
  });

  it("filters by platform", () => {
    const entries = [igEntry(), fbEntry()];
    const filtered = filterOutreachHubLeads(entries, {
      ...DEFAULT_OUTREACH_HUB_FILTERS,
      platform: "facebook",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.platform).toBe("facebook");
  });

  it("filters by status", () => {
    const entries = [igEntry({ status: "OUTREACH_SENT" }), igEntry({ id: "ig-2", status: "LEAD" })];
    const filtered = filterOutreachHubLeads(entries, {
      ...DEFAULT_OUTREACH_HUB_FILTERS,
      status: "OUTREACH_SENT",
    });
    expect(filtered).toHaveLength(1);
    expect((filtered[0]?.lead as { status: string }).status).toBe("OUTREACH_SENT");
  });

  it("filters by classification and target group", () => {
    const entries = [igEntry(), fbEntry()];
    expect(
      filterOutreachHubLeads(entries, {
        ...DEFAULT_OUTREACH_HUB_FILTERS,
        classification: "FOLLOW_UP_NEEDED",
      }),
    ).toHaveLength(1);

    expect(
      filterOutreachHubLeads(entries, {
        ...DEFAULT_OUTREACH_HUB_FILTERS,
        targetGroup: "ATL_LOCAL",
      }),
    ).toHaveLength(1);
  });

  it("filters by saved date range", () => {
    const entries = [igEntry(), fbEntry()];
    const filtered = filterOutreachHubLeads(entries, {
      ...DEFAULT_OUTREACH_HUB_FILTERS,
      savedFrom: "2026-06-08",
      savedTo: "2026-06-15",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.platform).toBe("instagram");
  });

  it("filters by search text", () => {
    const entries = [igEntry(), fbEntry()];
    expect(
      filterOutreachHubLeads(entries, {
        ...DEFAULT_OUTREACH_HUB_FILTERS,
        search: "atlanta fitness",
      }),
    ).toHaveLength(1);
    expect(hubLeadSearchText(fbEntry())).toContain("atlanta fitness");
  });

  it("exposes platform-specific status options", () => {
    const facebookStatuses = hubStatusFilterOptions("facebook").map((o) => o.id);
    expect(facebookStatuses).toContain("GROUP_JOINED");
    expect(facebookStatuses).not.toContain("FOLLOW_UP_1");

    const instagramStatuses = hubStatusFilterOptions("instagram").map((o) => o.id);
    expect(instagramStatuses).toContain("FOLLOW_UP_1");
    expect(instagramStatuses).not.toContain("GROUP_JOINED");
  });
});
