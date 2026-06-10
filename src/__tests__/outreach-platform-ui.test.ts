import { describe, expect, it } from "vitest";
import { stageLabelForOutreachGenerate } from "@/lib/outreach-platform-ui";

describe("outreach platform ui copy", () => {
  it("uses instagram-specific progress labels", () => {
    expect(stageLabelForOutreachGenerate("instagram", 40)).toContain("Verifying Instagram");
  });

  it("uses facebook-specific progress labels", () => {
    expect(stageLabelForOutreachGenerate("facebook", 10)).toContain("Facebook");
  });

  it("uses email-specific progress labels", () => {
    expect(stageLabelForOutreachGenerate("email", 30)).toContain("email");
  });
});
