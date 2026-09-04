import { describe, expect, it } from "vitest";
import type {
  EmailLeadRow,
  InstagramLeadRow,
  OutreachArchiveLead,
  OutreachHubLead,
  OutreachLane,
  OutreachPlatform,
} from "@/lib/outreach-types";
import {
  archiveOrigin,
  briefLeadMessageFields,
  computeLaneTiles,
  dispatchBriefLeads,
  filterLeadsByPlatform,
  followUpDueAt,
  formatOverdue,
  groupHubLeadsByLane,
  laneOf,
  leadDisplayName,
  manualQueueMessageFields,
  selectFollowUpLeads,
} from "@/app/admin/outreach/v2/components/helpers";

function igEntry(overrides: Partial<InstagramLeadRow> = {}): OutreachHubLead {
  return {
    platform: "instagram",
    savedToHubAt: "2026-07-20T12:00:00.000Z",
    lead: {
      id: overrides.id ?? Math.random().toString(36).slice(2),
      handle: overrides.handle ?? "@coach",
      profileUrl: "https://instagram.com/coach",
      niche: "strength",
      likelihoodScore: 80,
      whyMatchFit: "Fits",
      outreachIntent: null,
      outreachLane: overrides.outreachLane ?? "today",
      followUp1DueAt: overrides.followUp1DueAt ?? null,
      followUp2DueAt: overrides.followUp2DueAt ?? null,
      ...overrides,
    } as unknown as InstagramLeadRow,
  };
}

function emailEntry(overrides: Partial<EmailLeadRow> = {}): OutreachHubLead {
  return {
    platform: "email",
    savedToHubAt: "2026-07-20T12:00:00.000Z",
    lead: {
      id: overrides.id ?? Math.random().toString(36).slice(2),
      name: overrides.name ?? "Jane Coach",
      email: "jane@example.com",
      likelihoodScore: 70,
      whyMatchFit: "Fits",
      outreachIntent: null,
      outreachLane: overrides.outreachLane ?? "today",
      ...overrides,
    } as unknown as EmailLeadRow,
  };
}

describe("outreach-hq-v2 helpers", () => {
  it("laneOf reads the lane, defaulting to pending", () => {
    expect(laneOf(igEntry({ outreachLane: "past_due" }))).toBe("past_due");
    expect(laneOf(igEntry({ outreachLane: undefined as unknown as string }))).toBe("pending");
  });

  it("groups hub leads by lane", () => {
    const grouped = groupHubLeadsByLane([
      igEntry({ outreachLane: "today" }),
      igEntry({ outreachLane: "today" }),
      emailEntry({ outreachLane: "past_due" }),
      igEntry({ outreachLane: "follow_up_1" }),
      igEntry({ outreachLane: "pending" }),
    ]);
    expect(grouped.today).toHaveLength(2);
    expect(grouped.past_due).toHaveLength(1);
    expect(grouped.follow_up_1).toHaveLength(1);
    expect(grouped.pending).toHaveLength(1);
    expect(grouped.dispatch_queued).toHaveLength(0);
  });

  it("filters by platform with both = everything", () => {
    const entries = [igEntry(), emailEntry(), igEntry()];
    expect(filterLeadsByPlatform(entries, "both")).toHaveLength(3);
    expect(filterLeadsByPlatform(entries, "instagram")).toHaveLength(2);
    expect(filterLeadsByPlatform(entries, "email")).toHaveLength(1);
  });

  it("selects follow-up leads by stage", () => {
    const grouped = groupHubLeadsByLane([
      igEntry({ outreachLane: "follow_up_1" }),
      igEntry({ outreachLane: "follow_up_2" }),
      igEntry({ outreachLane: "follow_up_2" }),
    ]);
    expect(selectFollowUpLeads(grouped, "all")).toHaveLength(3);
    expect(selectFollowUpLeads(grouped, "follow_up_1")).toHaveLength(1);
    expect(selectFollowUpLeads(grouped, "follow_up_2")).toHaveLength(2);
  });

  it("resolves the correct follow-up due timestamp per lane", () => {
    const fu1 = igEntry({ outreachLane: "follow_up_1", followUp1DueAt: "2026-07-22T00:00:00.000Z" });
    const fu2 = igEntry({ outreachLane: "follow_up_2", followUp2DueAt: "2026-07-25T00:00:00.000Z" });
    expect(followUpDueAt(fu1)).toBe("2026-07-22T00:00:00.000Z");
    expect(followUpDueAt(fu2)).toBe("2026-07-25T00:00:00.000Z");
    expect(followUpDueAt(igEntry({ outreachLane: "today" }))).toBeNull();
  });

  it("formats overdue vs scheduled follow-ups", () => {
    const now = new Date("2026-07-23T00:00:00.000Z").getTime();
    expect(formatOverdue("2026-07-22T00:00:00.000Z", now)).toEqual({
      state: "overdue",
      label: "Overdue by 1d 0h",
    });
    expect(formatOverdue("2026-07-23T02:30:00.000Z", now)).toEqual({
      state: "scheduled",
      label: "Due in 2h 30m",
    });
    expect(formatOverdue(null, now).state).toBe("none");
  });

  it("classifies archive origin from deadLeadAt vs archivedAt proximity", () => {
    const manual: OutreachArchiveLead = {
      platform: "instagram",
      archivedAt: "2026-07-20T12:00:00.000Z",
      deadLeadAt: "2026-07-20T12:00:00.500Z",
      archivePurgeAfterAt: null,
      lead: igEntry().lead,
    };
    const dead: OutreachArchiveLead = {
      platform: "instagram",
      archivedAt: "2026-07-20T12:00:00.000Z",
      deadLeadAt: "2026-07-18T12:00:00.000Z",
      archivePurgeAfterAt: null,
      lead: igEntry().lead,
    };
    const noDead: OutreachArchiveLead = {
      platform: "email",
      archivedAt: "2026-07-20T12:00:00.000Z",
      deadLeadAt: null,
      archivePurgeAfterAt: null,
      lead: emailEntry().lead,
    };
    expect(archiveOrigin(manual)).toBe("manual");
    expect(archiveOrigin(dead)).toBe("dead_lead");
    expect(archiveOrigin(noDead)).toBe("dead_lead");
  });

  it("computes the six consolidated Outreach Hub tiles (follow-ups folded into Pending Leads)", () => {
    const grouped = groupHubLeadsByLane([
      igEntry({ outreachLane: "today" }),
      igEntry({ outreachLane: "dispatch_queued" }),
      igEntry({ outreachLane: "follow_up_1" }),
      igEntry({ outreachLane: "follow_up_2" }),
      igEntry({ outreachLane: "pending" }),
    ]);
    const tiles = computeLaneTiles(grouped, 4);
    expect(tiles).toHaveLength(6);
    expect(tiles.find((t) => t.lane === "today")?.count).toBe(1);
    expect(tiles.find((t) => t.lane === "dispatch_queued")?.count).toBe(1);
    // Pending Leads tile aggregates pending + both follow-up lanes.
    expect(tiles.find((t) => t.tab === "pending")?.count).toBe(3);
    expect(tiles.find((t) => t.lane === "archived")?.count).toBe(4);
  });

  it("reads dispatch brief leads tolerantly", () => {
    const leads = dispatchBriefLeads({
      leads: [
        { leadId: "a", platform: "instagram", displayName: "@a", contact: "url", outreachIntent: "BOTH" },
        { leadId: "b", platform: "email" },
        { notALead: true },
        "garbage",
      ],
    });
    expect(leads).toHaveLength(2);
    expect(leads[0]).toEqual({
      leadId: "a",
      platform: "instagram",
      displayName: "@a",
      contact: "url",
      outreachIntent: "BOTH",
    });
    expect(leads[1].displayName).toBe("b");
    expect(dispatchBriefLeads(null)).toEqual([]);
    expect(dispatchBriefLeads({})).toEqual([]);
  });

  it("reads display names per platform", () => {
    expect(leadDisplayName(igEntry({ handle: "@x" }))).toBe("@x");
    expect(leadDisplayName(emailEntry({ name: "Jane" }))).toBe("Jane");
  });

  it("reads message text off a dispatch brief lead", () => {
    expect(
      briefLeadMessageFields({
        leadId: "a",
        platform: "instagram",
        displayName: "@a",
        contact: "url",
        outreachIntent: null,
        dmText: "Hey there",
        commentText: "Nice post",
      }),
    ).toEqual([
      { label: "DM", text: "Hey there" },
      { label: "Comment", text: "Nice post" },
    ]);

    expect(
      briefLeadMessageFields({
        leadId: "b",
        platform: "email",
        displayName: "Jane",
        contact: "jane@example.com",
        outreachIntent: null,
        emailSubject: "Subject line",
        emailBody: "Body text",
      }),
    ).toEqual([
      { label: "Subject", text: "Subject line" },
      { label: "Body", text: "Body text" },
    ]);

    // Fields absent from the brief (e.g. a follow-up lead, since buildBatchBrief only ever
    // embeds primary-stage text) are simply omitted, never rendered blank.
    expect(
      briefLeadMessageFields({
        leadId: "c",
        platform: "facebook",
        displayName: "Page",
        contact: "url",
        outreachIntent: null,
      }),
    ).toEqual([]);
  });

  it("picks the manual-queue message stage from dispatchPreviousLane", () => {
    const primary = manualQueueMessageFields(
      igEntry({ dmText: "First DM", commentText: "First comment", dispatchPreviousLane: "today" }),
    );
    expect(primary).toEqual([
      { label: "First DM", text: "First DM" },
      { label: "Comment", text: "First comment" },
    ]);

    const followUp1 = manualQueueMessageFields(
      igEntry({
        dmText: "First DM",
        followUp1DmText: "Follow-up 1 DM",
        dispatchPreviousLane: "follow_up_1",
      }),
    );
    expect(followUp1).toEqual([{ label: "First follow-up DM", text: "Follow-up 1 DM" }]);

    const followUp2Email = manualQueueMessageFields(
      emailEntry({
        emailSubject: "Primary subject",
        emailBody: "Primary body",
        followUp2EmailSubject: "FU2 subject",
        followUp2EmailBody: "FU2 body",
        dispatchPreviousLane: "follow_up_2",
      }),
    );
    expect(followUp2Email).toEqual([
      { label: "Second follow-up subject", text: "FU2 subject" },
      { label: "Second follow-up email", text: "FU2 body" },
    ]);

    // No dispatchPreviousLane recorded (e.g. legacy data) falls back to primary text.
    const noStage = manualQueueMessageFields(
      emailEntry({ emailSubject: "Subject", emailBody: "Body" }),
    );
    expect(noStage).toEqual([
      { label: "Subject", text: "Subject" },
      { label: "Body", text: "Body" },
    ]);
  });
});

// Type-only guard: keep the fixture platform/lane types honest.
const _platform: OutreachPlatform = "instagram";
const _lane: OutreachLane = "today";
void _platform;
void _lane;
