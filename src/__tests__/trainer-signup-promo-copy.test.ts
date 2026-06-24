import { describe, expect, it } from "vitest";
import {
  trainerFoundingBgCheckBenefitShortLabel,
  trainerFoundingBgCheckEligibleTiersLabel,
  trainerFoundingPromoBullets,
  trainerFoundingPromoHeadline,
  trainerFoundingPromoParagraph,
} from "@/lib/trainer-signup-promo-copy";

describe("trainer-signup-promo-copy", () => {
  it("promotes fully covered background checks for Match Fit Pro and Premium Pro", () => {
    expect(trainerFoundingBgCheckEligibleTiersLabel()).toContain("Match Fit Pro");
    expect(trainerFoundingBgCheckEligibleTiersLabel()).toContain("Match Fit Premium Pro");
    expect(trainerFoundingBgCheckBenefitShortLabel()).toMatch(/fully covered background check/i);
    expect(trainerFoundingBgCheckBenefitShortLabel()).toMatch(/zero upfront cost/i);
  });

  it("does not tell founding coaches to pay for their background check", () => {
    const headline = trainerFoundingPromoHeadline(10);
    const paragraph = trainerFoundingPromoParagraph(10);
    const bullets = trainerFoundingPromoBullets(10).join(" ");

    for (const copy of [headline, paragraph, bullets]) {
      expect(copy).not.toMatch(/pay only their background check/i);
      expect(copy).not.toMatch(/pay your background check/i);
    }

    expect(headline).toMatch(/fully covered background check/i);
    expect(headline).toMatch(/zero upfront screening cost/i);
  });

  it("lists founding promo bullets in marketing order", () => {
    const bullets = trainerFoundingPromoBullets(10);
    expect(bullets).toHaveLength(3);
    expect(bullets[0]).toMatch(/Fully covered background check/i);
    expect(bullets[1]).toMatch(/60 days of Match Fit Premium Pro/i);
    expect(bullets[2]).toMatch(/Begin onboarding within 7 days/i);
  });
});
