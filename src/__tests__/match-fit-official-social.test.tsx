import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MatchFitOfficialSocialIcon } from "@/components/match-fit-official-social-icons";
import {
  MATCH_FIT_OFFICIAL_SOCIAL_LINKS,
  type MatchFitOfficialSocialPlatform,
} from "@/lib/match-fit-official-social";

describe("MATCH_FIT_OFFICIAL_SOCIAL_LINKS", () => {
  it("keeps one unique entry per social platform", () => {
    const platforms = MATCH_FIT_OFFICIAL_SOCIAL_LINKS.map((item) => item.platform);
    expect(platforms).toEqual<MatchFitOfficialSocialPlatform[]>([
      "threads",
      "tiktok",
      "facebook",
      "instagram",
    ]);
    expect(new Set(platforms).size).toBe(platforms.length);
  });

  it("uses non-empty labels and secure absolute URLs", () => {
    for (const link of MATCH_FIT_OFFICIAL_SOCIAL_LINKS) {
      expect(link.label.trim().length).toBeGreaterThan(0);
      expect(link.href).toMatch(/^https:\/\/[^\s]+$/);
    }
  });
});

describe("MatchFitOfficialSocialIcon", () => {
  it.each(MATCH_FIT_OFFICIAL_SOCIAL_LINKS)("renders SVG markup for $platform", ({ platform }) => {
    const markup = renderToStaticMarkup(
      <MatchFitOfficialSocialIcon platform={platform} className="size-6" />,
    );

    expect(markup).toContain("<svg");
    expect(markup).toContain('class="size-6"');
  });

  it("generates a colon-free Instagram gradient id that matches the fill url", () => {
    const markup = renderToStaticMarkup(<MatchFitOfficialSocialIcon platform="instagram" />);
    const match = markup.match(/<linearGradient id="([^"]+)"/);

    expect(match).not.toBeNull();
    const gradientId = match?.[1] ?? "";
    expect(gradientId).not.toContain(":");
    expect(markup).toContain(`fill="url(#${gradientId})"`);
  });
});
