import { describe, expect, it } from "vitest";
import {
  FP_ELITE_PRO_DEBRIEF,
  FP_INDEPENDENT_PRO_DEBRIEF,
  FP_MATCH_FIT_PRO_DEBRIEF,
} from "@/lib/fp-tier-debrief-copy";

describe("fp-tier-debrief-copy", () => {
  it("defines three debrief sections with three blocks each", () => {
    for (const section of [FP_MATCH_FIT_PRO_DEBRIEF, FP_INDEPENDENT_PRO_DEBRIEF, FP_ELITE_PRO_DEBRIEF]) {
      expect(section.blocks).toHaveLength(3);
      expect(section.id.length).toBeGreaterThan(0);
      expect(section.title.length).toBeGreaterThan(0);
    }
  });

  it("combines onboarding, publishing, and brand guidance for Match Fit Pros", () => {
    expect(FP_MATCH_FIT_PRO_DEBRIEF.blocks.map((b) => b.title)).toEqual([
      "Fitness Pro Onboarding Fee",
      "Publish Between Sessions",
      "Your Brand. Your Business.",
    ]);
  });
});
