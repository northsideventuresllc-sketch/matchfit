import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { trainerSocialBrandIconMock } = vi.hoisted(() => ({
  trainerSocialBrandIconMock: vi.fn<(props: { platform: string; className?: string }) => void>(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: unknown;
    children: ReactNode;
  } & Record<string, unknown>) => <a href={typeof href === "string" ? href : String(href)} {...props}>{children}</a>,
}));

vi.mock("@/components/trainer/trainer-social-brand-icons", () => ({
  TrainerSocialBrandIcon: (props: { platform: string; className?: string }) => {
    trainerSocialBrandIconMock(props);
    return <svg data-platform={props.platform} className={props.className} aria-hidden />;
  },
}));

import { MatchFitSocialLinks } from "@/components/match-fit-social-links";
import { MATCH_FIT_OFFICIAL_SOCIAL_LINKS } from "@/lib/match-fit-official-social";

describe("MatchFitSocialLinks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders every official social link with secure external attributes", () => {
    const html = renderToStaticMarkup(<MatchFitSocialLinks />);

    expect(html).toContain("Follow Match Fit");
    for (const item of MATCH_FIT_OFFICIAL_SOCIAL_LINKS) {
      expect(html).toContain(`href="${item.href}"`);
      expect(html).toContain(`title="Match Fit on ${item.label}"`);
    }
    expect((html.match(/target="_blank"/g) ?? []).length).toBe(MATCH_FIT_OFFICIAL_SOCIAL_LINKS.length);
    expect((html.match(/rel="noopener noreferrer"/g) ?? []).length).toBe(MATCH_FIT_OFFICIAL_SOCIAL_LINKS.length);
  });

  it("uses compact sizing when compact variant is selected", () => {
    const html = renderToStaticMarkup(<MatchFitSocialLinks variant="compact" />);
    const expectedIconClass = "h-5 w-5";

    expect(html).toContain(expectedIconClass);
    expect(html).not.toContain("sm:gap-4");
    const nonThreadsCount = MATCH_FIT_OFFICIAL_SOCIAL_LINKS.filter((item) => item.platform !== "threads").length;
    expect(trainerSocialBrandIconMock).toHaveBeenCalledTimes(nonThreadsCount);
    for (const [call] of trainerSocialBrandIconMock.mock.calls) {
      expect(call.className).toBe(expectedIconClass);
    }
  });

  it("uses the dedicated Threads icon instead of the shared trainer icon map", () => {
    const html = renderToStaticMarkup(<MatchFitSocialLinks variant="footer" />);

    expect(html).toContain("h-6 w-6");
    expect(html).toContain("sm:gap-4");
    expect(html).toContain('fill="#101010"');
    expect(
      trainerSocialBrandIconMock.mock.calls.some(([call]) => call.platform === "threads"),
    ).toBe(false);
  });
});
