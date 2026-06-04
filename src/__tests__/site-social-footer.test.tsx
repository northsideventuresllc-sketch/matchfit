import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { usePathnameMock } = vi.hoisted(() => ({
  usePathnameMock: vi.fn(() => "/"),
}));

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
}));

vi.mock("@/components/match-fit-social-links", () => ({
  MatchFitSocialLinks: () => <div data-component="match-fit-social-links" />,
}));

import { SiteSocialFooter } from "@/components/site-social-footer";

describe("SiteSocialFooter", () => {
  it("renders on public pages", () => {
    usePathnameMock.mockReturnValue("/promos");
    const html = renderToStaticMarkup(<SiteSocialFooter />);
    expect(html).toContain('data-component="match-fit-social-links"');
  });

  it("hides on dashboard routes", () => {
    usePathnameMock.mockReturnValue("/client/dashboard");
    const html = renderToStaticMarkup(<SiteSocialFooter />);
    expect(html).toBe("");
  });
});
