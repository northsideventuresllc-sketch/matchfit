import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FeaturedTrainersCarousel } from "@/components/featured-trainers-carousel";
import type { FeaturedTrainerCard } from "@/lib/featured-homepage-data";

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

function buildTrainer(overrides: Partial<FeaturedTrainerCard> = {}): FeaturedTrainerCard {
  return {
    username: "coach-one",
    displayName: "Coach One",
    specialtyLine: "Strength training",
    profileImageUrl: "https://cdn.example.com/profile.jpg?token=abc123",
    source: "PAID_BID",
    ...overrides,
  };
}

describe("FeaturedTrainersCarousel", () => {
  it("renders nothing when no featured trainers are available", () => {
    expect(renderToStaticMarkup(<FeaturedTrainersCarousel trainers={[]} />)).toBe("");
    expect(renderToStaticMarkup(<FeaturedTrainersCarousel />)).toBe("");
  });

  it("renders trainer details and strips query params from profile images", () => {
    const html = renderToStaticMarkup(<FeaturedTrainersCarousel trainers={[buildTrainer()]} />);

    expect(html).toContain("Featured Fitness Pros in your area");
    expect(html).toContain("Sponsored");
    expect(html).toContain('src="https://cdn.example.com/profile.jpg"');
    expect(html).toContain('href="/trainers/coach-one"');
  });

  it("falls back to initials and raffle label when image is missing", () => {
    const html = renderToStaticMarkup(
      <FeaturedTrainersCarousel
        trainers={[
          buildTrainer({
            username: "fit-jane",
            displayName: "Jane Doe",
            profileImageUrl: null,
            source: "RAFFLE",
          }),
        ]}
      />,
    );

    expect(html).toContain("Raffle feature");
    expect(html).toContain(">JD<");
    expect(html).toContain('href="/trainers/fit-jane"');
  });
});
