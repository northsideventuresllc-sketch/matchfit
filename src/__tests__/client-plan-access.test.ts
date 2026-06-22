import { describe, expect, it } from "vitest";
import {
  canSeeNudgeSenderIdentity,
  getFreemiumRestrictions,
  isClientFreemiumGated,
} from "@/lib/client-plan-access";

describe("client plan access", () => {
  it("allows chat and initial questionnaire on freemium restrictions", () => {
    const restrictions = getFreemiumRestrictions();
    expect(restrictions.canChat).toBe(true);
    expect(restrictions.canCompleteInitialMatchQuestionnaire).toBe(true);
    expect(restrictions.canUseDailyQuestionnaire).toBe(false);
    expect(restrictions.canSeeNudgeSenderIdentity).toBe(false);
  });

  it("hides nudge sender identity for freemium clients", () => {
    const now = Date.now();
    expect(
      canSeeNudgeSenderIdentity(
        {
          clientPlanTier: "FREEMIUM",
          vipSubscriptionActive: false,
          freemiumSwipeCount: 0,
          freemiumSwipeWindowStartAt: null,
          platformTrialEndsAt: new Date(now - 86_400_000),
          stripeSubscriptionActive: false,
        },
        now,
      ),
    ).toBe(false);
  });

  it("shows nudge sender identity for VIP clients", () => {
    expect(
      canSeeNudgeSenderIdentity({
        clientPlanTier: "VIP",
        vipSubscriptionActive: true,
        freemiumSwipeCount: 0,
        freemiumSwipeWindowStartAt: null,
      }),
    ).toBe(true);
  });

  it("treats active platform trial as not freemium gated", () => {
    const now = Date.now();
    expect(
      isClientFreemiumGated({
        clientPlanTier: "FREEMIUM",
        vipSubscriptionActive: false,
        freemiumSwipeCount: 0,
        freemiumSwipeWindowStartAt: null,
        platformTrialEndsAt: new Date(now + 86_400_000),
        stripeSubscriptionActive: false,
      }),
    ).toBe(false);
  });
});
