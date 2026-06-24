import { describe, expect, it } from "vitest";
import { classifyOutreachLead, statusTimestampsForUpdate } from "@/lib/outreach-classification";

const now = new Date("2026-06-06T12:00:00Z");

describe("classifyOutreachLead", () => {
  it("returns dead lead when status is DEAD_LEAD", () => {
    expect(
      classifyOutreachLead({
        status: "DEAD_LEAD",
        platform: "instagram",
        outreachSentAt: null,
        followUp1SentAt: null,
        followUp2SentAt: null,
        responseReceivedAt: null,
        createdAt: new Date("2026-06-05T12:00:00Z"),
        now,
      }),
    ).toBe("DEAD_LEAD");
  });

  it("marks fresh leads as active", () => {
    expect(
      classifyOutreachLead({
        status: "LEAD",
        platform: "instagram",
        outreachSentAt: null,
        followUp1SentAt: null,
        followUp2SentAt: null,
        responseReceivedAt: null,
        createdAt: new Date("2026-06-05T12:00:00Z"),
        now,
      }),
    ).toBe("ACTIVE_LEAD");
  });

  it("flags instagram follow-up after 3 days with no response", () => {
    expect(
      classifyOutreachLead({
        status: "OUTREACH_SENT",
        platform: "instagram",
        outreachSentAt: new Date("2026-06-01T12:00:00Z"),
        followUp1SentAt: null,
        followUp2SentAt: null,
        responseReceivedAt: null,
        createdAt: new Date("2026-06-01T12:00:00Z"),
        now,
      }),
    ).toBe("FOLLOW_UP_NEEDED");
  });

  it("marks instagram dead after 14 days with no response", () => {
    expect(
      classifyOutreachLead({
        status: "OUTREACH_SENT",
        platform: "instagram",
        outreachSentAt: new Date("2026-05-20T12:00:00Z"),
        followUp1SentAt: null,
        followUp2SentAt: null,
        responseReceivedAt: null,
        createdAt: new Date("2026-05-20T12:00:00Z"),
        now,
      }),
    ).toBe("DEAD_LEAD");
  });

  it("does not use instagram-style follow-up stages for facebook pipeline statuses", () => {
    expect(
      classifyOutreachLead({
        status: "POST_SUBMITTED_PENDING_REVIEW",
        platform: "facebook",
        outreachSentAt: new Date("2026-05-20T12:00:00Z"),
        followUp1SentAt: null,
        followUp2SentAt: null,
        responseReceivedAt: null,
        createdAt: new Date("2026-05-20T12:00:00Z"),
        now,
      }),
    ).toBe("FOLLOW_UP_NEEDED");
  });

  it("keeps responded leads active", () => {
    expect(
      classifyOutreachLead({
        status: "RESPONSE_RECEIVED",
        platform: "email",
        outreachSentAt: new Date("2026-05-01T12:00:00Z"),
        followUp1SentAt: null,
        followUp2SentAt: null,
        responseReceivedAt: new Date("2026-05-03T12:00:00Z"),
        createdAt: new Date("2026-05-01T12:00:00Z"),
        now,
      }),
    ).toBe("ACTIVE_LEAD");
  });

  it("keeps fresh second follow-up leads active while waiting for a response", () => {
    expect(
      classifyOutreachLead({
        status: "FOLLOW_UP_2",
        platform: "instagram",
        outreachSentAt: new Date("2026-05-20T12:00:00Z"),
        followUp1SentAt: new Date("2026-05-27T12:00:00Z"),
        followUp2SentAt: new Date("2026-06-04T12:00:00Z"),
        responseReceivedAt: null,
        createdAt: new Date("2026-05-20T12:00:00Z"),
        now,
      }),
    ).toBe("ACTIVE_LEAD");
  });

  it("marks second follow-up leads dead after 7 days with no response", () => {
    expect(
      classifyOutreachLead({
        status: "FOLLOW_UP_2",
        platform: "email",
        outreachSentAt: new Date("2026-05-20T12:00:00Z"),
        followUp1SentAt: new Date("2026-05-27T12:00:00Z"),
        followUp2SentAt: new Date("2026-05-28T12:00:00Z"),
        responseReceivedAt: null,
        createdAt: new Date("2026-05-20T12:00:00Z"),
        now,
      }),
    ).toBe("DEAD_LEAD");
  });
});

describe("statusTimestampsForUpdate", () => {
  const now = new Date("2026-06-06T12:00:00Z");

  it("refreshes followUp2SentAt when advancing from first to second follow-up", () => {
    const stamps = statusTimestampsForUpdate(
      "FOLLOW_UP_2",
      {
        outreachSentAt: new Date("2026-05-20T12:00:00Z"),
        followUp1SentAt: new Date("2026-05-27T12:00:00Z"),
        followUp2SentAt: new Date("2026-05-28T12:00:00Z"),
        responseReceivedAt: null,
      },
      now,
      "FOLLOW_UP_1",
    );

    expect(stamps.followUp2SentAt).toEqual(now);
    expect(stamps.followUp1SentAt).toEqual(new Date("2026-05-27T12:00:00Z"));
  });
});
