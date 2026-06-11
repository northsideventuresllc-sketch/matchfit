import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  } & Record<string, unknown>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { HomeBetaPromoBanner } from "@/components/home-beta-promo-banner";
import { MATCH_FIT_PRODUCT_VERSION_ANNOUNCE } from "@/lib/match-fit-product-version";

describe("HomeBetaPromoBanner", () => {
  it("renders versioned beta promo content above the fold", () => {
    const html = renderToStaticMarkup(<HomeBetaPromoBanner />);

    expect(html).toContain('id="beta-welcome"');
    expect(html).toContain(`Version ${MATCH_FIT_PRODUCT_VERSION_ANNOUNCE}`);
    expect(html).toContain("Founding member promos");
    expect(html).toContain("60 days of Premium status");
    expect(html).toContain("cannot sell or offer services");
    expect(html).toContain('href="/promos"');
    expect(html).toContain('href="#follow-match-fit"');
  });
});
