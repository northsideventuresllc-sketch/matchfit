import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { MatchFitOfficialSocialIcon } from "@/components/match-fit-official-social-icons";
import { MatchFitSocialLinks } from "@/components/match-fit-social-links";
import { MATCH_FIT_OFFICIAL_SOCIAL_LINKS } from "@/lib/match-fit-official-social";

function countMatches(input: string, needle: string) {
  return input.split(needle).length - 1;
}

describe("MATCH_FIT_OFFICIAL_SOCIAL_LINKS", () => {
  it("keeps one secure profile URL for each supported platform", () => {
    expect(MATCH_FIT_OFFICIAL_SOCIAL_LINKS).toHaveLength(4);
    expect(MATCH_FIT_OFFICIAL_SOCIAL_LINKS.map((item) => item.platform)).toEqual([
      "threads",
      "tiktok",
      "facebook",
      "instagram",
    ]);

    const uniquePlatforms = new Set(MATCH_FIT_OFFICIAL_SOCIAL_LINKS.map((item) => item.platform));
    expect(uniquePlatforms.size).toBe(MATCH_FIT_OFFICIAL_SOCIAL_LINKS.length);

    for (const item of MATCH_FIT_OFFICIAL_SOCIAL_LINKS) {
      expect(item.label).toBeTruthy();
      expect(item.href.startsWith("https://")).toBe(true);
    }
  });
});

describe("MatchFitOfficialSocialIcon", () => {
  it("renders an SVG icon for every platform", () => {
    for (const item of MATCH_FIT_OFFICIAL_SOCIAL_LINKS) {
      const markup = renderToStaticMarkup(
        <MatchFitOfficialSocialIcon platform={item.platform} className="h-6 w-6" />,
      );
      expect(markup).toContain("<svg");
      expect(markup).toContain('class="h-6 w-6"');
      expect(markup).toContain("aria-hidden");
    }
  });

  it("sanitizes generated Instagram gradient IDs for SVG URL references", () => {
    const markup = renderToStaticMarkup(
      <MatchFitOfficialSocialIcon platform="instagram" className="h-5 w-5" />,
    );
    const gradientIdMatch = markup.match(/<linearGradient id="([^"]+)"/);

    expect(gradientIdMatch).not.toBeNull();
    expect(gradientIdMatch?.[1]).not.toContain(":");
    expect(markup).toContain(`url(#${gradientIdMatch?.[1]})`);
  });
});

describe("MatchFitSocialLinks", () => {
  it("renders every official link with safe external-link attributes for footer variant", () => {
    const markup = renderToStaticMarkup(
      <MatchFitSocialLinks variant="footer" className="mx-auto w-full max-w-3xl" />,
    );

    expect(markup).toContain("Follow Match Fit");
    expect(markup).toContain('aria-label="Match Fit on social media"');
    expect(countMatches(markup, 'target="_blank"')).toBe(MATCH_FIT_OFFICIAL_SOCIAL_LINKS.length);
    expect(countMatches(markup, 'rel="noopener noreferrer"')).toBe(
      MATCH_FIT_OFFICIAL_SOCIAL_LINKS.length,
    );
    expect(markup).toContain("h-11 w-11");
    expect(markup).toContain("h-6 w-6");
    expect(markup).toContain("sm:gap-4");

    for (const item of MATCH_FIT_OFFICIAL_SOCIAL_LINKS) {
      expect(markup).toContain(`href="${item.href}"`);
      expect(markup).toContain(`title="Match Fit on ${item.label}"`);
      expect(markup).toContain(`<span class="sr-only">${item.label}</span>`);
    }
  });

  it("uses compact sizing when compact variant is requested", () => {
    const markup = renderToStaticMarkup(<MatchFitSocialLinks variant="compact" />);

    expect(markup).toContain("h-10 w-10");
    expect(markup).toContain("h-5 w-5");
    expect(markup).not.toContain("sm:gap-4");
  });
});
