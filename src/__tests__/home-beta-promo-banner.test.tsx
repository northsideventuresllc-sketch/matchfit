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
import { getTrainerFoundingBgPercentMax } from "@/lib/match-fit-launch-promotion-caps";
import { TRAINER_SIGNUP_PREMIUM_PROMO_DAYS } from "@/lib/trainer-signup-promo-copy";

describe("HomeBetaPromoBanner", () => {
  it("renders versioned beta promo content above the fold", () => {
    const html = renderToStaticMarkup(<HomeBetaPromoBanner />);
    const trainerFoundingCap = getTrainerFoundingBgPercentMax();

    expect(html).toContain('id="beta-welcome"');
    // The old top pill badges are gone (item 5).
    expect(html).not.toContain("Welcome to Match Fit");

    // Heading renamed to "Active Promotions" (item 6) — CSS uppercase-transforms the source text.
    expect(html).toContain("Active Promotions");

    // "As of May 21st..." version paragraph is preserved (just relocated per item 4).
    expect(html).toContain(`In Version ${MATCH_FIT_PRODUCT_VERSION_ANNOUNCE}`);
    expect(html).toContain("Report A Bug");

    // Sub-bubble replaced with the founding promo note verbatim (items 4 & 7).
    expect(html).toContain("Founding Fitness Pro Beta Promotion");
    expect(html).toContain(`First ${trainerFoundingCap} Coaches`);
    expect(html).toContain("Listers");
    expect(html).toContain(`get premium access for ${TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days for`);
    expect(html).toContain(`get listing access for ${TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days for`);
    expect(html).toContain("FREE");
    expect(html).toContain("Background checks are");
    expect(html).toContain("FULLY");
    expect(html).toContain("set up a subscription");
    expect(html).toContain("subscription pricing");

    // Fitness Pro / Independent Pro / Elite Pro are hyperlinked (buttons) with hover/click
    // definitions (item 7) — the definition tooltip itself only mounts once opened, so this
    // checks the trigger markup; hover/click behavior is confirmed in the browser.
    expect(html.match(/Fitness Pros/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("Independent Pros");
    expect(html.match(/Elite Pros/g)?.length).toBeGreaterThanOrEqual(3);
    expect(html.match(/aria-expanded="false"/g)?.length).toBeGreaterThanOrEqual(5);

    // Footnote: "Once the caps are hit..." now lives in the same footnote as "...everywhere." (item 2),
    // and "Beta rollout" is visually all caps via CSS (items 2 & 8).
    expect(html).toContain("available worldwide");
    expect(html).toContain("Virtual coaching and discovery are available everywhere.");
    expect(html).toContain("you will be able to");
    expect(html).toContain("reserve your username on a waitlist");
    expect(html).toMatch(/class="[^"]*uppercase[^"]*">Beta rollout:/);

    // Buttons: renamed + centered row, redundant follow-us anchor replaced with a popover (item 3).
    expect(html).toContain("View Details");
    expect(html).not.toContain("View current promos");
    expect(html).toContain("Follow Us For Updates");
    expect(html).not.toContain('href="#follow-match-fit"');
    expect(html).toMatch(/class="[^"]*sm:justify-center[^"]*"/);

    expect(html).toContain('href="/promos"');
  });
});
