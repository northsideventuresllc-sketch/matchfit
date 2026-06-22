import { describe, expect, it } from "vitest";
import {
  isClientAccountLoginBlocked,
  isClientBillingHardLocked,
  resolveClientPlatformAccessPhase,
} from "@/lib/client-platform-access";

const base = {
  stripeSubscriptionId: null as string | null,
  stripeSubscriptionActive: false,
  subscriptionGraceUntil: null as Date | null,
  platformTrialEndsAt: null as Date | null,
  paymentGraceUntil: null as Date | null,
  accountDeactivatedAt: null as Date | null,
  platformTrialConsumed: false,
  vipSubscriptionActive: false,
  clientPlanTier: "FREEMIUM",
};

describe("client platform access", () => {
  it("returns platform_trial while trial end is in the future", () => {
    const now = Date.parse("2026-06-01T12:00:00.000Z");
    expect(
      resolveClientPlatformAccessPhase(
        {
          ...base,
          platformTrialEndsAt: new Date("2026-06-10T12:00:00.000Z"),
        },
        now,
      ),
    ).toBe("platform_trial");
    expect(isClientBillingHardLocked({ ...base, platformTrialEndsAt: new Date("2026-06-10T12:00:00.000Z") }, now)).toBe(
      false,
    );
  });

  it("returns freemium after beta VIP trial ends without paid VIP", () => {
    const now = Date.parse("2026-06-15T12:00:00.000Z");
    const client = {
      ...base,
      platformTrialEndsAt: new Date("2026-06-01T12:00:00.000Z"),
      platformTrialConsumed: true,
      clientPlanTier: "FREEMIUM",
    };
    expect(resolveClientPlatformAccessPhase(client, now)).toBe("freemium");
    expect(isClientBillingHardLocked(client, now)).toBe(false);
    expect(isClientAccountLoginBlocked(client, now)).toBe(false);
  });

  it("returns vip when paid VIP subscription is active", () => {
    const now = Date.now();
    expect(
      resolveClientPlatformAccessPhase(
        {
          ...base,
          vipSubscriptionActive: true,
          clientPlanTier: "VIP",
        },
        now,
      ),
    ).toBe("vip");
  });

  it("returns payment_grace for legacy accounts still in grace", () => {
    const now = Date.parse("2026-06-15T12:00:00.000Z");
    const client = {
      ...base,
      platformTrialEndsAt: new Date("2026-06-01T12:00:00.000Z"),
      paymentGraceUntil: new Date("2026-06-29T12:00:00.000Z"),
      platformTrialConsumed: true,
    };
    expect(resolveClientPlatformAccessPhase(client, now)).toBe("payment_grace");
    expect(isClientBillingHardLocked(client, now)).toBe(true);
    expect(isClientAccountLoginBlocked(client, now)).toBe(false);
  });

  it("blocks login after legacy payment grace expires without subscription", () => {
    const now = Date.parse("2026-07-01T12:00:00.000Z");
    const client = {
      ...base,
      platformTrialEndsAt: new Date("2026-06-01T12:00:00.000Z"),
      paymentGraceUntil: new Date("2026-06-15T12:00:00.000Z"),
      platformTrialConsumed: true,
      accountDeactivatedAt: new Date("2026-06-16T12:00:00.000Z"),
    };
    expect(resolveClientPlatformAccessPhase(client, now)).toBe("deactivated");
    expect(isClientAccountLoginBlocked(client, now)).toBe(true);
  });

  it("returns paid when stripe subscription is active", () => {
    const now = Date.now();
    expect(
      resolveClientPlatformAccessPhase(
        {
          ...base,
          stripeSubscriptionId: "sub_123",
          stripeSubscriptionActive: true,
        },
        now,
      ),
    ).toBe("paid");
  });
});
