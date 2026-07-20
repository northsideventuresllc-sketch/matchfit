import { describe, expect, it } from "vitest";
import {
  OUTREACH_READY_LEAD_TARGET,
  countOutreachReadyLeads,
  hasOutreachSendableCopy,
  isOutreachReadyIntent,
  isOutreachReadyLead,
  pickCoworkBriefLeads,
} from "@/lib/outreach-ready-leads";

describe("outreach-ready-leads", () => {
  it("recognizes Join-as-FP and Both intents only", () => {
    expect(isOutreachReadyIntent("JOIN_AS_FP")).toBe(true);
    expect(isOutreachReadyIntent("BOTH")).toBe(true);
    expect(isOutreachReadyIntent("LIST_WITH_US")).toBe(false);
    expect(isOutreachReadyIntent(null)).toBe(false);
  });

  it("requires sendable copy per platform", () => {
    expect(hasOutreachSendableCopy("instagram", { dmText: "Hey" })).toBe(true);
    expect(hasOutreachSendableCopy("instagram", { dmText: "  " })).toBe(false);
    expect(
      hasOutreachSendableCopy("email", { emailSubject: "Hi", emailBody: "Body" }),
    ).toBe(true);
    expect(hasOutreachSendableCopy("email", { emailSubject: "Hi", emailBody: "" })).toBe(false);
  });

  it("marks hub Join-as-FP LEAD with copy as ready", () => {
    expect(
      isOutreachReadyLead("instagram", {
        status: "LEAD",
        outreachIntent: "JOIN_AS_FP",
        savedToHubAt: new Date(),
        dmText: "Hey trainer",
      }),
    ).toBe(true);
  });

  it("rejects unsent / wrong intent / missing hub / missing copy", () => {
    expect(
      isOutreachReadyLead("instagram", {
        status: "OUTREACH_SENT",
        outreachIntent: "JOIN_AS_FP",
        savedToHubAt: new Date(),
        dmText: "Hey",
      }),
    ).toBe(false);
    expect(
      isOutreachReadyLead("instagram", {
        status: "LEAD",
        outreachIntent: "LIST_WITH_US",
        savedToHubAt: new Date(),
        dmText: "Hey",
      }),
    ).toBe(false);
    expect(
      isOutreachReadyLead("instagram", {
        status: "LEAD",
        outreachIntent: "JOIN_AS_FP",
        savedToHubAt: null,
        dmText: "Hey",
      }),
    ).toBe(false);
  });

  it("counts ready leads against the REV-FIRST target", () => {
    const counts = countOutreachReadyLeads({
      instagram: Array.from({ length: 12 }, () => ({
        status: "LEAD",
        outreachIntent: "JOIN_AS_FP",
        savedToHubAt: new Date(),
        dmText: "dm",
      })),
      email: Array.from({ length: 3 }, () => ({
        status: "LEAD",
        outreachIntent: "BOTH",
        savedToHubAt: new Date(),
        emailSubject: "s",
        emailBody: "b",
      })),
    });
    expect(counts.total).toBe(15);
    expect(counts.meetsTarget).toBe(true);
    expect(OUTREACH_READY_LEAD_TARGET).toBe(15);
  });

  it("picks ready Join-as-FP leads first for Cowork brief caps", () => {
    const picked = pickCoworkBriefLeads(
      "instagram",
      [
        {
          id: "a",
          status: "LEAD",
          outreachIntent: null,
          savedToHubAt: null,
          dmText: "",
        },
        {
          id: "b",
          status: "LEAD",
          outreachIntent: "JOIN_AS_FP",
          savedToHubAt: new Date(),
          dmText: "ready",
        },
        {
          id: "c",
          status: "LEAD",
          outreachIntent: "BOTH",
          savedToHubAt: new Date(),
          dmText: "ready2",
        },
      ],
      2,
    );
    expect(picked.map((row) => row.id)).toEqual(["b", "c"]);
  });
});
