import { describe, expect, it } from "vitest";
import { matchFitGradientCtaClassName } from "@/components/match-fit-gradient-cta";

describe("matchFitGradientCtaClassName", () => {
  it("uses a flat gradient background without isolate or nested-layer helpers", () => {
    const classes = matchFitGradientCtaClassName();
    expect(classes).toContain("mf-gradient-cta");
    expect(classes).toContain("bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]");
    expect(classes).toContain("touch-manipulation");
    expect(classes).not.toContain("isolate");
    expect(classes).not.toContain("active:translate");
  });
});
