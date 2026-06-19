import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { matchFitSocialLinksMock } = vi.hoisted(() => ({
  matchFitSocialLinksMock: vi.fn<(props: { variant?: "footer" | "compact"; className?: string }) => void>(),
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

vi.mock("@/components/match-fit-social-links", () => ({
  MatchFitSocialLinks: (props: { variant?: "footer" | "compact"; className?: string }) => {
    matchFitSocialLinksMock(props);
    return <div data-component="match-fit-social-links" data-variant={props.variant ?? "footer"} />;
  },
}));

import { LegalPageFooterNav } from "@/components/legal-page-footer-nav";

describe("LegalPageFooterNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders client dashboard navigation for client role", () => {
    const html = renderToStaticMarkup(<LegalPageFooterNav role="client" />);

    expect(html).toContain("Previous page");
    expect(html).toContain('href="/client/dashboard"');
    expect(html).not.toContain('href="/trainer/dashboard"');
    expect(html).not.toContain("Back to Home");
    expect(matchFitSocialLinksMock).not.toHaveBeenCalled();
  });

  it("renders trainer dashboard navigation for trainer role", () => {
    const html = renderToStaticMarkup(<LegalPageFooterNav role="trainer" />);

    expect(html).toContain("Previous page");
    expect(html).toContain('href="/trainer/dashboard"');
    expect(html).not.toContain('href="/client/dashboard"');
    expect(html).not.toContain("Back to Home");
    expect(matchFitSocialLinksMock).not.toHaveBeenCalled();
  });

  it("renders guest sign-up links and compact social links", () => {
    const html = renderToStaticMarkup(<LegalPageFooterNav role="guest" />);

    expect(html).toContain('data-component="match-fit-social-links"');
    expect(html).toContain("Back to Home");
    expect(html).toContain("Client sign up");
    expect(html).toContain("Trainer sign up");
    expect(html).not.toContain("Previous page");
    expect(matchFitSocialLinksMock).toHaveBeenCalledWith({ variant: "compact" });
  });
});
