import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: unknown;
    children: ReactNode;
  } & Record<string, unknown>) => (
    <a href={typeof href === "string" ? href : String(href)} {...props}>
      {children}
    </a>
  ),
}));

import { BetaCapFullSignupNotice } from "@/components/beta-cap-full-signup-notice";

describe("BetaCapFullSignupNotice", () => {
  it("renders the nationwide client waitlist messaging and CTA", () => {
    const html = renderToStaticMarkup(
      <BetaCapFullSignupNotice
        role="client"
        waitlistHref="/waitlist/client"
        cap={250}
        count={250}
      />,
    );

    expect(html).toContain("Memberships are full for this beta");
    expect(html).toContain("Anyone in the United States can still join the waitlist");
    expect(html).toContain(">Join the client waitlist<");
    expect(html).toContain('href="/waitlist/client"');
    expect(html).toContain("Clients signed up: 250 / 250");
  });

  it("renders trainer-specific copy and trainer waitlist CTA", () => {
    const html = renderToStaticMarkup(
      <BetaCapFullSignupNotice
        role="trainer"
        waitlistHref="/waitlist/trainer"
        cap={50}
        count={50}
      />,
    );

    expect(html).toContain("Fitness Pro slots are full for this beta");
    expect(html).toContain("All Fitness Pro slots for the Atlanta metro beta are taken.");
    expect(html).toContain(">Join the Fitness Pro waitlist<");
    expect(html).toContain("Fitness Pros signed up: 50 / 50");
  });

  it("shows reserved-slot suffix only when used slots differ from signup count", () => {
    const html = renderToStaticMarkup(
      <BetaCapFullSignupNotice
        role="client"
        waitlistHref="/waitlist/client"
        cap={250}
        count={220}
        slotsUsed={245}
      />,
    );

    expect(html).toContain("Clients signed up: 220 / 250");
    expect(html).toContain("(245 slots reserved including pending invites)");
  });

  it("omits cap line when cap or count is missing", () => {
    const html = renderToStaticMarkup(
      <BetaCapFullSignupNotice
        role="client"
        waitlistHref="/waitlist/client"
        cap={null}
        count={220}
        slotsUsed={220}
      />,
    );

    expect(html).not.toContain("signed up:");
    expect(html).not.toContain("slots reserved including pending invites");
  });
});
