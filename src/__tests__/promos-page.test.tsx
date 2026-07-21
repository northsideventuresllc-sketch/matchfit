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

  it("renders product version and updated beta-reach copy", async () => {
    const html = await renderPromos();

    expect(html).toContain(`Version ${MATCH_FIT_PRODUCT_VERSION_LABEL}`);
    expect(html).toContain("Beta reach:");
    expect(html).toContain("available worldwide");
    expect(html).toContain("Up to 30 Fitness Pros");
    expect(html).toContain("In-person sessions roll out by region");
    expect(html).toContain("7 / 50");
    expect(html).toContain("2 / 10");
    expect(html).toContain("60-day VIP access");
    expect(html).toContain("no card required at sign-up");
    expect(html).toContain("Free plan or VIP upgrade");
    expect(html).toContain("60 days of Match Fit Premium Pro");
    expect(html).toContain("Fully covered background check");
    expect(html).toContain("zero upfront cost");
    expect(html).toContain("Match Fit Pro, Match Fit Premium Pro, and Elite Fitness Pro");
    expect(html).toContain("60 days free");
    expect(html).toContain("$15.00 per month");
    expect(html).toContain("Free Independent Pro trial at sign-up");
    expect(html).toContain("Independent Pro platform trial");

    expect(html).toContain("cannot sell or offer services");
  });

  it("shows sign-up CTAs when beta capacity is not full", async () => {
    getLaunchPromoStatsMock.mockResolvedValueOnce(
      makeStats({
        trainerWaitlistOpen: false,
        clientWaitlistOpen: false,
      }),
    );

    const html = await renderPromos();

    expect(html).toContain('href="/trainer/signup"');
    expect(html).toContain("Sign Up as a Fitness Pro");
    expect(html).toContain('href="/client/sign-up"');
    expect(html).toContain("Sign Up as a Client");
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
    expect(html).not.toContain("Sign Up as a Fitness Pro");
    expect(html).not.toContain("Sign Up as a Client");
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
