import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MatchFitOfficialSocialIcon } from "@/components/match-fit-official-social-icons";
import {
  MATCH_FIT_OFFICIAL_SOCIAL_LINKS,
  type MatchFitOfficialSocialPlatform,
} from "@/lib/match-fit-official-social";

const PLATFORM_MARKERS: Record<MatchFitOfficialSocialPlatform, readonly string[]> = {
  threads: ['fill="#000000"', "M141.537 88.9883", 'viewBox="0 0 192 192"'],
  tiktok: ['fill="#25F4EE"', 'fill="#FE2C55"', "M19.589 6.686"],
  facebook: ['fill="#1877F2"', "M13.2 20.5"],
  instagram: ["<linearGradient", 'stop-color="#FEDA75"'],
};

describe("MatchFitOfficialSocialIcon", () => {
  it("renders an accessible SVG for every official platform and forwards className", () => {
    for (const { platform } of MATCH_FIT_OFFICIAL_SOCIAL_LINKS) {
      const html = renderToStaticMarkup(
        <MatchFitOfficialSocialIcon platform={platform} className="h-6 w-6" />,
      );

      expect(html).toContain('<svg viewBox="0 0 24 24" class="h-6 w-6" aria-hidden="true">');
      for (const marker of PLATFORM_MARKERS[platform]) {
        expect(html).toContain(marker);
      }
    }
  });

  it("generates sanitized unique gradient ids when multiple instagram icons render together", () => {
    const html = renderToStaticMarkup(
      <>
        <MatchFitOfficialSocialIcon platform="instagram" />
        <MatchFitOfficialSocialIcon platform="instagram" />
      </>,
    );

    const gradientIds = Array.from(html.matchAll(/<linearGradient id="([^"]+)"/g), ([, id]) => id);

    expect(gradientIds).toHaveLength(2);
    expect(new Set(gradientIds).size).toBe(2);
    for (const gradientId of gradientIds) {
      expect(gradientId).not.toContain(":");
      expect(html).toContain(`fill="url(#${gradientId})"`);
    }
  });
});
