import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getLaunchPromoStatsMock, getClientFoundingTrialDaysMock } = vi.hoisted(() => ({
  getLaunchPromoStatsMock: vi.fn(),
  getClientFoundingTrialDaysMock: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const imageProps = { ...props };
    delete imageProps.fill;
    delete imageProps.priority;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...(imageProps as React.ImgHTMLAttributes<HTMLImageElement>)} alt={(imageProps.alt as string) ?? ""} />;
  },
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

vi.mock("@/lib/launch-promo-stats", () => ({
  getLaunchPromoStats: getLaunchPromoStatsMock,
}));

vi.mock("@/lib/match-fit-launch-promotions", () => ({
  getClientFoundingTrialDays: getClientFoundingTrialDaysMock,
}));

import PromosPage from "@/app/promos/page";
import type { LaunchPromoStats } from "@/lib/launch-promo-stats";
import { MATCH_FIT_PRODUCT_VERSION_LABEL } from "@/lib/match-fit-product-version";

function makeStats(overrides?: Partial<LaunchPromoStats>): LaunchPromoStats {
  return {
    gatesEnabled: true,
    trainerCount: 2,
    clientCount: 7,
    trainerCountAvailable: true,
    clientCountAvailable: true,
    trainerFoundingMax: 10,
    clientFoundingMax: 50,
    trainerFoundingRemaining: 8,
    clientFoundingRemaining: 43,
    trainerFoundingActive: true,
    clientFoundingActive: true,
    trainerBetaCap: 30,
    clientBetaCap: 50,
    trainerBetaSlotsUsed: 13,
    clientBetaSlotsUsed: 12,
    trainerBetaSlotsAvailable: true,
    clientBetaSlotsAvailable: true,
    trainerBetaSlotsRemaining: 17,
    clientBetaSlotsRemaining: 38,
    trainerBetaCapAtlanta: 10,
    trainerBetaCapVirtual: 20,
    trainerBetaSlotsUsedAtlanta: 3,
    trainerBetaSlotsUsedVirtual: 10,
    trainerBetaSlotsRemainingAtlanta: 7,
    trainerBetaSlotsRemainingVirtual: 10,
    trainerWaitlistOpen: false,
    clientWaitlistOpen: false,
    ...overrides,
  };
}

async function renderPromos() {
  const markup = await PromosPage();
  return renderToStaticMarkup(markup);
}

describe("promos page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLaunchPromoStatsMock.mockResolvedValue(makeStats());
    getClientFoundingTrialDaysMock.mockReturnValue(60);
  });

  it("renders product version and all-caps beta-reach copy with the region sentence removed", async () => {
    const html = await renderPromos();

    expect(html).toContain(`Version ${MATCH_FIT_PRODUCT_VERSION_LABEL}`);
    expect(html).toContain("Beta reach:");
    expect(html).toContain("available worldwide");
    expect(html).toContain("Up to 30 Fitness Pros");
    // "Beta reach:" and "available worldwide" are rendered uppercase via CSS (source stays sentence case).
    expect(html).toContain('class="font-semibold uppercase text-[#FF7E00]/90">Beta reach:</span>');
    expect(html).toContain('class="font-semibold uppercase text-white/70">available worldwide</span>');
    // The dropped region/virtual-coaching sentence must be gone entirely.
    expect(html).not.toContain("In-person sessions roll out by region");
    expect(html).not.toContain("virtual coaching is available wherever the product supports it");

    expect(html).toContain("7 / 50");
    expect(html).toContain("2 / 10");
    expect(html).toContain("60-day VIP access");
    expect(html).toContain("no card required at sign-up");
  });

  it("never renders the bare 'Fit Pro' typo anywhere on the page", async () => {
    const html = await renderPromos();
    expect(html).not.toMatch(/\bFit Pro\b/);
  });

  it("shows a PROMO DETAILS block with the waived background check and three role collapsibles", async () => {
    const html = await renderPromos();

    // All-caps subtitle (sentence case in source + uppercase CSS).
    expect(html).toContain(">Promo details<");
    expect(html).toContain('uppercase tracking-[0.16em] text-[#FF7E00]/90">Promo details<');

    // Background check waived for the first 30 coach sign-ups (hardcoded per the parallel cap-fix PR).
    expect(html).toContain("waived completely for the first 30 coach sign-ups");

    // Three collapsible <details> menus, one per sign-up type, using JB's exact role definitions.
    expect(html).toContain("<summary");
    expect((html.match(/<details/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(html).toContain(">Fitness Pro<");
    expect(html).toContain(">Independent Pro<");
    expect(html).toContain(">Elite Pro<");

    expect(html).toContain(
      "Coaches who decide to use Match Fit as a management software to find, connect, manage, and process clients. Best for coaches who are more of an indie coach who is an entrepreneur.",
    );
    expect(html).toContain(
      "Coaches and fitness businesses who decide to use Match Fit as a listing platform to link clients back to their established website/brand. Best for coaches and businesses that are looking for another channel of online exposure to bring in new clients.",
    );
    expect(html).toContain(
      "Coaches and fitness businesses looking to get the best of both worlds in what Fitness Pro status and Independent Pro status offers. Best for coaches and businesses looking to integrate a new management platform into their business while looking to acquire new clients.",
    );

    expect(html).toContain("Premium access free for 60 days.");
    expect(html).toContain("Listing access free for 60 days.");
    expect((html.match(/Background check fully covered\./g) ?? []).length).toBe(2);
    expect(html).toContain("$15.00 per month subscription");
    expect(html).toContain("$40.00 per month subscription");

    // Onboarding language does not belong on this page anymore.
    expect(html).not.toContain("cannot sell or offer services");
    expect(html).not.toContain("Onboarding must begin within");
    expect(html).not.toContain("Begin onboarding within");

    // The now-redundant standalone Independent Pro trial bubble is gone.
    expect(html).not.toContain("Independent Pro platform trial");
  });

  it("shows sign-up CTAs when beta capacity is not full, centered and labeled Sign Up Now", async () => {
    getLaunchPromoStatsMock.mockResolvedValueOnce(
      makeStats({
        trainerWaitlistOpen: false,
        clientWaitlistOpen: false,
      }),
    );

    const html = await renderPromos();

    expect(html).toContain('href="/trainer/signup"');
    expect(html).toContain('href="/client/sign-up"');
    expect(html).not.toContain("Sign Up as a Fitness Pro");
    expect(html).not.toContain("Sign Up as a Client");
    expect((html.match(/Sign Up Now/g) ?? []).length).toBe(2);
    expect((html.match(/class="mt-6 flex justify-center"/g) ?? []).length).toBe(2);
    expect(html).not.toContain("Join Fitness Pro Waitlist");
    expect(html).not.toContain("Join Client Waitlist");
    expect(html).not.toContain("Atlanta in-person beta pool");
    expect(html).toContain("Beta membership capacity: 12 / 50 slots used (38 open)");
  });

  it("switches to waitlist CTAs when capacity gates are full", async () => {
    getLaunchPromoStatsMock.mockResolvedValueOnce(
      makeStats({
        trainerWaitlistOpen: true,
        clientWaitlistOpen: true,
        trainerBetaSlotsRemainingAtlanta: 0,
        trainerBetaSlotsRemainingVirtual: 0,
        clientBetaSlotsRemaining: 0,
      }),
    );

    const html = await renderPromos();

    expect(html).toContain('href="/waitlist/trainer"');
    expect(html).toContain("Join Fitness Pro Waitlist");
    expect(html).toContain('href="/waitlist/client"');
    expect(html).toContain("Join Client Waitlist");
    expect(html).not.toContain("Atlanta in-person beta pool");
    expect(html).toContain("Beta membership capacity: 12 / 50 slots used (full — waitlist open)");
    expect(html).not.toContain("Sign Up Now");
  });

  it("deletes the client sub-bubble as redundant with the paragraph above it", async () => {
    const html = await renderPromos();

    expect(html).not.toContain("Beta VIP trial at sign-up</span>");
    expect(html).not.toContain("Free plan or VIP upgrade");
    // The summary line above still carries the same facts.
    expect(html).toContain("Free plan unless you subscribe to VIP");
  });

  it("deletes the trailing 'after the founding caps are reached' bubble entirely", async () => {
    const html = await renderPromos();

    expect(html).not.toContain("After the founding caps are reached");
  });

  it("shows an honest unavailable state instead of a fake 0 when a count query failed", async () => {
    getLaunchPromoStatsMock.mockResolvedValueOnce(
      makeStats({
        trainerCountAvailable: false,
        clientCountAvailable: false,
        clientBetaSlotsAvailable: false,
      }),
    );

    const html = await renderPromos();

    expect(html).not.toContain("2 / 10");
    expect(html).not.toContain("7 / 50");
    expect(html.match(/Live count is temporarily unavailable/g)?.length).toBe(2);
    expect(html).toContain("Beta membership capacity: temporarily unavailable — check back shortly.");
  });

  it("shows founding-ended messaging when founding slots are full", async () => {
    getLaunchPromoStatsMock.mockResolvedValueOnce(
      makeStats({
        gatesEnabled: false,
        trainerCount: 10,
        trainerFoundingRemaining: 0,
        trainerFoundingActive: false,
        trainerWaitlistOpen: false,
        clientCount: 50,
        clientFoundingRemaining: 0,
        clientFoundingActive: false,
        clientWaitlistOpen: false,
      }),
    );

    const html = await renderPromos();

    expect(html).toContain(">Ended<");
    expect(html).not.toContain("Beta membership capacity:");
    expect(html.match(/Founding spots are full\. Standard pricing now applies\./g)?.length).toBe(2);
  });
});
