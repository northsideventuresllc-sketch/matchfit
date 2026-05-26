import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string | { toString(): string };
    children: unknown;
  }) =>
    createElement(
      "a",
      {
        href: typeof href === "string" ? href : href.toString(),
        ...rest,
      },
      children,
    ),
}));

import { MatchFitSocialLinks } from "@/components/match-fit-social-links";
import { MATCH_FIT_OFFICIAL_SOCIAL_LINKS } from "@/lib/match-fit-official-social";
import {
  MATCH_FIT_PRODUCT_VERSION_ANNOUNCE,
  MATCH_FIT_PRODUCT_VERSION_LABEL,
} from "@/lib/match-fit-product-version";

describe("MATCH_FIT_OFFICIAL_SOCIAL_LINKS", () => {
  it("keeps exactly one link per supported platform", () => {
    expect(MATCH_FIT_OFFICIAL_SOCIAL_LINKS).toHaveLength(4);

    const platforms = MATCH_FIT_OFFICIAL_SOCIAL_LINKS.map((link) => link.platform).sort();
    expect(platforms).toEqual(["facebook", "instagram", "threads", "tiktok"]);
  });

  it("uses non-empty labels and https URLs", () => {
    for (const link of MATCH_FIT_OFFICIAL_SOCIAL_LINKS) {
      expect(link.label.trim().length).toBeGreaterThan(0);
      expect(link.href).toMatch(/^https:\/\//);
    }
  });
});

describe("MatchFitSocialLinks", () => {
  it("renders one outbound social link per official profile", () => {
    const html = renderToStaticMarkup(createElement(MatchFitSocialLinks));

    expect(html).toContain("Follow Match Fit");
    expect((html.match(/target=\"_blank\"/g) ?? []).length).toBe(MATCH_FIT_OFFICIAL_SOCIAL_LINKS.length);
    expect((html.match(/rel=\"noopener noreferrer\"/g) ?? []).length).toBe(
      MATCH_FIT_OFFICIAL_SOCIAL_LINKS.length,
    );

    for (const link of MATCH_FIT_OFFICIAL_SOCIAL_LINKS) {
      expect(html).toContain(`href="${link.href}"`);
      expect(html).toContain(`<span class="sr-only">${link.label}</span>`);
    }
  });

  it("switches icon sizing based on visual variant", () => {
    const footerHtml = renderToStaticMarkup(createElement(MatchFitSocialLinks, { variant: "footer" }));
    const compactHtml = renderToStaticMarkup(createElement(MatchFitSocialLinks, { variant: "compact" }));

    expect(footerHtml).toContain("h-6 w-6");
    expect(compactHtml).toContain("h-5 w-5");
    expect(compactHtml).toContain("text-[0.65rem]");
  });
});

describe("match-fit product version constants", () => {
  it("keeps label and announce strings aligned to the same semantic version", () => {
    expect(MATCH_FIT_PRODUCT_VERSION_LABEL).toMatch(/^BETA \d+\.\d+\.\d+$/);
    expect(MATCH_FIT_PRODUCT_VERSION_ANNOUNCE).toMatch(/^\d+\.\d+\.\d+-BETA$/);

    const labelVersion = MATCH_FIT_PRODUCT_VERSION_LABEL.replace(/^BETA /, "");
    const announceVersion = MATCH_FIT_PRODUCT_VERSION_ANNOUNCE.replace(/-BETA$/, "");
    expect(labelVersion).toBe(announceVersion);
  });
});
