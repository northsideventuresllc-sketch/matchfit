import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  homeUserCounterMock,
  matchFitSocialLinksMock,
} = vi.hoisted(() => ({
  homeUserCounterMock: vi.fn(),
  matchFitSocialLinksMock: vi.fn(),
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

vi.mock("@/components/home-cta-logout-bar", () => ({
  HomeCtaLogoutBar: () => <div data-component="home-cta-logout-bar" />,
}));

vi.mock("@/components/home-beta-slot-warning", () => ({
  HomeBetaSlotWarning: () => <div data-component="home-beta-slot-warning" />,
}));

vi.mock("@/components/home-trainer-service-types-section", () => ({
  HomeTrainerServiceTypesSection: () => <div data-component="home-trainer-service-types-section" />,
}));

vi.mock("@/components/home-user-counter", () => ({
  HomeUserCounter: (props: unknown) => {
    homeUserCounterMock(props);
    return <div data-component="home-user-counter" />;
  },
}));

vi.mock("@/components/match-fit-social-links", () => ({
  MatchFitSocialLinks: (props: unknown) => {
    matchFitSocialLinksMock(props);
    return <div data-component="match-fit-social-links" />;
  },
}));

import { HomeInfoSections } from "@/components/home-info-sections";
import { MATCH_FIT_PRODUCT_VERSION_ANNOUNCE } from "@/lib/match-fit-product-version";

describe("HomeInfoSections", () => {
  const homeUserCounts = {
    trainersTotal: 11,
    trainersActive: 8,
    clientsTotal: 22,
    clientsActive: 13,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the logged-out CTA and versioned announcement", () => {
    const html = renderToStaticMarkup(
      <HomeInfoSections
        homeAuth={{ clientLoggedIn: false, trainerLoggedIn: false }}
        homeUserCounts={homeUserCounts}
      />,
    );

    expect(html).toContain(`Version ${MATCH_FIT_PRODUCT_VERSION_ANNOUNCE}`);
    expect(html).toContain('data-component="home-beta-slot-warning"');
    expect(html).not.toContain('data-component="home-cta-logout-bar"');
    expect(html).toContain('href="/client/sign-up"');
    expect(html).toContain('href="/trainer/signup"');
    expect(homeUserCounterMock).toHaveBeenCalledWith(homeUserCounts);
    expect(matchFitSocialLinksMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "footer" }),
    );
  });

  it("renders logout CTA for signed-in users instead of sign-up buttons", () => {
    const html = renderToStaticMarkup(
      <HomeInfoSections
        homeAuth={{ clientLoggedIn: true, trainerLoggedIn: false }}
        homeUserCounts={homeUserCounts}
      />,
    );

    expect(html).toContain('data-component="home-cta-logout-bar"');
    expect(html).not.toContain('data-component="home-beta-slot-warning"');
    expect(html).not.toContain("Find My Match");
    expect(html).not.toContain("Build My Fitness Brand");
    expect(matchFitSocialLinksMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "footer" }),
    );
  });
});
