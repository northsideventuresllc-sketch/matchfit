import { describe, expect, it } from "vitest";
import {
  MATCH_FIT_MARKETING_PLAYBOOK_STEPS,
  matchFitMarketingPlaybookLabel,
  matchFitMarketingPlaybookStepById,
} from "@/lib/match-fit-marketing-playbook";

describe("match-fit-marketing-playbook", () => {
  it("defines exactly 8 sequential steps", () => {
    expect(MATCH_FIT_MARKETING_PLAYBOOK_STEPS).toHaveLength(8);
    expect(MATCH_FIT_MARKETING_PLAYBOOK_STEPS.map((s) => s.step)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("maps ad campaign registry to step 8", () => {
    const step = matchFitMarketingPlaybookStepById("register_and_review");
    expect(step.step).toBe(8);
    expect(step.adminPath).toBe("/admin/ad-tracking");
  });

  it("marks organic publish and paid launch as JB lane", () => {
    expect(matchFitMarketingPlaybookStepById("publish_organic").jbLane).toBe(true);
    expect(matchFitMarketingPlaybookStepById("launch_paid").jbLane).toBe(true);
  });

  it("formats step labels for UI copy", () => {
    expect(matchFitMarketingPlaybookLabel(2)).toBe("Step 2 — Generate content");
  });
});
