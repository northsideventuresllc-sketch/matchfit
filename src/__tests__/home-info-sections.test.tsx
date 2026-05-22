import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CLIENT_SIGN_UP_PATH, TRAINER_SIGN_UP_PATH } from "@/lib/home-page-auth";
import { HomeInfoSections } from "@/components/home-info-sections";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/home-cta-logout-bar", () => ({
  HomeCtaLogoutBar: () => <div data-testid="logout-cta">Mock Logout CTA</div>,
}));

vi.mock("@/components/home-trainer-service-types-section", () => ({
  HomeTrainerServiceTypesSection: () => (
    <section data-testid="trainer-service-types">Mock Trainer Service Types</section>
  ),
}));

describe("HomeInfoSections", () => {
  it("renders the beta launch welcome section and founding promo details", () => {
    const html = renderToStaticMarkup(
      <HomeInfoSections homeAuth={{ clientLoggedIn: false, trainerLoggedIn: false }} />,
    );

    expect(html).toContain('id="beta-welcome"');
    expect(html).toContain("We are live — Version 1.0.0-BETA");
    expect(html).toContain("May 21st, 2026");
    expect(html).toContain("Founding member promos — active until caps are reached");
    expect(html).toContain("First 10 fitness professionals:");
    expect(html).toContain("20% of the background check cost");
    expect(html).toContain("First 50 clients:");
    expect(html).toContain("14 days on the platform are 100% free");
    expect(html).toContain("reserve your username on a waitlist");
    expect(html).toContain("Atlanta metro area");
    expect(html).toContain('href="/report-bug"');
  });

  it("shows sign-up CTAs for logged-out visitors", () => {
    const html = renderToStaticMarkup(
      <HomeInfoSections homeAuth={{ clientLoggedIn: false, trainerLoggedIn: false }} />,
    );

    expect(html).toContain("Find My Match");
    expect(html).toContain("Build My Fitness Brand");
    expect(html).toContain(`href="${CLIENT_SIGN_UP_PATH}"`);
    expect(html).toContain(`href="${TRAINER_SIGN_UP_PATH}"`);
    expect(html).not.toContain("Mock Logout CTA");
  });

  it("shows the logout CTA when either role is logged in", () => {
    const html = renderToStaticMarkup(
      <HomeInfoSections homeAuth={{ clientLoggedIn: true, trainerLoggedIn: false }} />,
    );

    expect(html).toContain("Mock Logout CTA");
    expect(html).not.toContain(`href="${CLIENT_SIGN_UP_PATH}"`);
    expect(html).not.toContain(`href="${TRAINER_SIGN_UP_PATH}"`);
  });
});
