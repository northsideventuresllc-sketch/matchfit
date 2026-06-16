import { describe, expect, it } from "vitest";
import type { OutreachHubLead } from "@/lib/outreach-types";
import {
  computeOutreachHubStats,
  isOutreachHubMetricNotApplicable,
  resolveOutreachHubMetricCount,
} from "@/lib/outreach-hub-stats";

function hubEntry(
  platform: OutreachHubLead["platform"],
  overrides: Record<string, unknown> = {},
): OutreachHubLead {
  const baseLead = {
    id: `${platform}-1`,
    autoClassification: "ACTIVE_LEAD",
    status: "LEAD",
    ...overrides,
  };

  return {
    platform,
    savedToHubAt: "2026-06-01T12:00:00.000Z",
    lead: baseLead as OutreachHubLead["lead"],
  };
}

describe("computeOutreachHubStats", () => {
  it("counts hub metrics by platform from saved hub entries only", () => {
    const entries: OutreachHubLead[] = [
      hubEntry("instagram", { id: "ig-1", autoClassification: "ACTIVE_LEAD", status: "LEAD" }),
      hubEntry("instagram", {
        id: "ig-2",
        autoClassification: "FOLLOW_UP_NEEDED",
        status: "OUTREACH_SENT",
      }),
      hubEntry("instagram", {
        id: "ig-3",
        autoClassification: "ACTIVE_LEAD",
        status: "RESPONSE_RECEIVED",
      }),
      hubEntry("email", {
        id: "em-1",
        autoClassification: "FOLLOW_UP_NEEDED",
        status: "FOLLOW_UP_1",
      }),
      hubEntry("facebook", {
        id: "fb-1",
        autoClassification: "FOLLOW_UP_NEEDED",
        status: "POST_SUBMITTED_PENDING_REVIEW",
      }),
      hubEntry("facebook", {
        id: "fb-2",
        autoClassification: "ACTIVE_LEAD",
        status: "RESPONSE_RECEIVED",
      }),
    ];

    const stats = computeOutreachHubStats(entries, 3);

    expect(stats.totalInHub).toBe(6);
    expect(stats.archived).toBe(3);
    expect(stats.activeLeads).toEqual({ all: 3, instagram: 2, facebook: 1, email: 0 });
    expect(stats.followUpNeeded).toEqual({ all: 2, instagram: 1, facebook: 0, email: 1 });
    expect(stats.responses).toEqual({ all: 2, instagram: 1, facebook: 1, email: 0 });
  });
});

describe("resolveOutreachHubMetricCount", () => {
  it("returns the selected platform bucket", () => {
    const counts = { all: 5, instagram: 2, facebook: 1, email: 2 };
    expect(resolveOutreachHubMetricCount(counts, "all")).toBe(5);
    expect(resolveOutreachHubMetricCount(counts, "instagram")).toBe(2);
    expect(resolveOutreachHubMetricCount(counts, "facebook")).toBe(1);
    expect(resolveOutreachHubMetricCount(counts, "email")).toBe(2);
  });
});

describe("isOutreachHubMetricNotApplicable", () => {
  it("marks Facebook follow-up as not applicable", () => {
    expect(isOutreachHubMetricNotApplicable("followUpNeeded", "facebook")).toBe(true);
    expect(isOutreachHubMetricNotApplicable("followUpNeeded", "instagram")).toBe(false);
    expect(isOutreachHubMetricNotApplicable("activeLeads", "facebook")).toBe(false);
    expect(isOutreachHubMetricNotApplicable("responses", "facebook")).toBe(false);
  });
});
