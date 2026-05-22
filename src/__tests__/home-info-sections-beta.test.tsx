import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CLIENT_SIGN_UP_PATH, TRAINER_SIGN_UP_PATH } from "@/lib/home-page-auth";
import { HomeInfoSections } from "@/components/home-info-sections";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/home-cta-logout-bar", () => ({
  HomeCtaLogoutBar: () => <div data-testid="home-cta-logout-bar">logout-bar</div>,
}));

vi.mock("@/components/home-trainer-service-types-section", () => ({
  HomeTrainerServiceTypesSection: () => <div data-testid="trainer-service-types">service-types</div>,
}));

describe("HomeInfoSections beta content", () => {
  it("renders the beta welcome section with launch promos and bug-report link", () => {
    const html = renderToStaticMarkup(
      <HomeInfoSections
        homeAuth={{
          clientLoggedIn: false,
          trainerLoggedIn: false,
        }}
      />,
    );

    expect(html).toContain("id=\"beta-welcome\"");
    expect(html).toContain("We are live — Version 1.0.0-BETA");
    expect(html).toContain("Founding member promos — active until caps are reached");
    expect(html).toContain("First 10 fitness professionals:");
    expect(html).toContain("First 50 clients:");
    expect(html).toContain("href=\"/report-bug\"");
    expect(html).toContain("Atlanta metro area");
  });

  it("shows signed-out CTAs and swaps to logout CTA when authenticated", () => {
    const signedOutHtml = renderToStaticMarkup(
      <HomeInfoSections
        homeAuth={{
          clientLoggedIn: false,
          trainerLoggedIn: false,
        }}
      />,
    );
    expect(signedOutHtml).toContain(`href="${CLIENT_SIGN_UP_PATH}"`);
    expect(signedOutHtml).toContain(`href="${TRAINER_SIGN_UP_PATH}"`);
    expect(signedOutHtml).not.toContain("home-cta-logout-bar");

    const loggedInHtml = renderToStaticMarkup(
      <HomeInfoSections
        homeAuth={{
          clientLoggedIn: true,
          trainerLoggedIn: false,
        }}
      />,
    );
    expect(loggedInHtml).toContain("home-cta-logout-bar");
    expect(loggedInHtml).not.toContain(`href="${CLIENT_SIGN_UP_PATH}"`);
    expect(loggedInHtml).not.toContain(`href="${TRAINER_SIGN_UP_PATH}"`);
  });
});
