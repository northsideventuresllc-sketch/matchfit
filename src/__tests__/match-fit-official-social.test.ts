import { describe, expect, it } from "vitest";
import { MATCH_FIT_OFFICIAL_SOCIAL_LINKS } from "@/lib/match-fit-official-social";

describe("MATCH_FIT_OFFICIAL_SOCIAL_LINKS", () => {
  it("keeps each supported platform represented exactly once", () => {
    const platforms = MATCH_FIT_OFFICIAL_SOCIAL_LINKS.map((item) => item.platform);
    expect(new Set(platforms).size).toBe(platforms.length);
    expect([...platforms].sort()).toEqual(["facebook", "instagram", "threads", "tiktok"]);
  });

  it("keeps non-empty labels and absolute https URLs", () => {
    for (const item of MATCH_FIT_OFFICIAL_SOCIAL_LINKS) {
      expect(item.label.trim().length).toBeGreaterThan(0);
      const parsed = new URL(item.href);
      expect(parsed.protocol).toBe("https:");
      expect(parsed.hostname.length).toBeGreaterThan(0);
    }
  });
});
