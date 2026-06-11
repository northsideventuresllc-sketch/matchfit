import { describe, expect, it } from "vitest";
import {
  buildMassDeleteOutreachWhere,
  buildMassSaveOutreachWhere,
  buildOutreachHubCsv,
} from "@/lib/outreach-data";
import type { OutreachHubLead } from "@/lib/outreach-types";

describe("buildMassDeleteOutreachWhere", () => {
  it("scopes delete-all to active generation leads only", () => {
    expect(buildMassDeleteOutreachWhere({ mode: "all" })).toEqual({
      deletedAt: null,
      savedToHubAt: null,
      archivedAt: null,
      status: { not: "DEAD_LEAD" },
    });
  });

  it("scopes delete-batch to a generation batch", () => {
    expect(
      buildMassDeleteOutreachWhere({ mode: "batch", generationBatchId: "batch_123_admin" }),
    ).toEqual({
      deletedAt: null,
      savedToHubAt: null,
      archivedAt: null,
      status: { not: "DEAD_LEAD" },
      generationBatchId: "batch_123_admin",
    });
  });

  it("scopes delete-ids to selected active leads", () => {
    expect(buildMassDeleteOutreachWhere({ mode: "ids", ids: ["a", "b"] })).toEqual({
      deletedAt: null,
      savedToHubAt: null,
      archivedAt: null,
      status: { not: "DEAD_LEAD" },
      id: { in: ["a", "b"] },
    });
  });
});

describe("buildMassSaveOutreachWhere", () => {
  it("uses the same active-lead scope as bulk delete", () => {
    expect(buildMassSaveOutreachWhere({ mode: "all" })).toEqual({
      deletedAt: null,
      savedToHubAt: null,
      archivedAt: null,
      status: { not: "DEAD_LEAD" },
    });
    expect(buildMassSaveOutreachWhere({ mode: "batch", generationBatchId: "batch_1" })).toEqual({
      deletedAt: null,
      savedToHubAt: null,
      archivedAt: null,
      status: { not: "DEAD_LEAD" },
      generationBatchId: "batch_1",
    });
  });
});

describe("buildOutreachHubCsv", () => {
  it("exports saved hub leads with headers and escaped values", () => {
    const leads: OutreachHubLead[] = [
      {
        platform: "instagram",
        savedToHubAt: "2026-06-09T12:00:00.000Z",
        lead: {
          id: "ig_1",
          handle: "coach_j",
          profileUrl: "https://instagram.com/coach_j",
          niche: "Strength",
          targetGroup: "ATL_LOCAL",
          whyMatchFit: "Active community",
          likelihoodScore: 80,
          notes: null,
          dmText: "Hey there",
          commentText: "Great post",
          commentPostRef: null,
          genericInviteTail: null,
          status: "LEAD",
          autoClassification: "ACTIVE_LEAD",
          outreachSentAt: null,
          followUp1SentAt: null,
          followUp2SentAt: null,
          responseReceivedAt: null,
          dmTextEdited: false,
          commentTextEdited: false,
          generationBatchId: null,
          createdAt: "2026-06-08T12:00:00.000Z",
          deletedAt: null,
          savedToHubAt: "2026-06-09T12:00:00.000Z",
          deadLeadAt: null,
          archivedAt: null,
          archivePurgeAfterAt: null,
        },
      },
    ];

    const csv = buildOutreachHubCsv(leads);
    expect(csv.split("\n")[0]).toContain("Platform,Name,Contact");
    expect(csv).toContain("instagram,coach_j,https://instagram.com/coach_j");
    expect(csv).toContain("Active community");
  });
});
