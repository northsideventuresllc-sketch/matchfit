import { describe, expect, it } from "vitest";
import {
  b2cRunbook5bChecklist,
  b2cRunbook5bReady,
  b2cRunbookPhaseLabel,
  MATCH_FIT_B2C_RUNBOOK_PHASES_5B_6B,
} from "@/lib/match-fit-b2c-runbook";

describe("match-fit-b2c-runbook", () => {
  it("defines phases 5b and 6b mapped to playbook steps 5 and 6", () => {
    expect(MATCH_FIT_B2C_RUNBOOK_PHASES_5B_6B.map((p) => p.phase)).toEqual(["5b", "6b"]);
    expect(MATCH_FIT_B2C_RUNBOOK_PHASES_5B_6B[0]?.playbookStep).toBe(5);
    expect(MATCH_FIT_B2C_RUNBOOK_PHASES_5B_6B[1]?.playbookStep).toBe(6);
  });

  it("requires client signup conversion for 5b readiness", () => {
    expect(
      b2cRunbook5bReady({
        clientSignupConversionConfigured: true,
        trainerSignupConversionConfigured: false,
        metaCapiConfigured: false,
        ga4Configured: false,
      }),
    ).toBe(true);
    expect(
      b2cRunbook5bReady({
        clientSignupConversionConfigured: false,
        trainerSignupConversionConfigured: true,
        metaCapiConfigured: true,
        ga4Configured: true,
      }),
    ).toBe(false);
  });

  it("builds a 5b checklist with client conversion status", () => {
    const items = b2cRunbook5bChecklist({
      clientSignupConversionConfigured: true,
      trainerSignupConversionConfigured: true,
      metaCapiConfigured: false,
      ga4Configured: true,
    });
    expect(items.find((i) => i.label.includes("Client signup"))?.ok).toBe(true);
    expect(items.find((i) => i.label.includes("Meta CAPI"))?.ok).toBe(false);
  });

  it("formats phase labels for admin UI", () => {
    expect(b2cRunbookPhaseLabel("5b")).toBe("Runbook 5b — Confirm client tags");
  });
});
