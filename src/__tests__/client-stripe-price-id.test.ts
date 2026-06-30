import { afterEach, describe, expect, it } from "vitest";
import { resolveClientVipStripePriceId } from "@/lib/client-stripe-price-id";

describe("resolveClientVipStripePriceId", () => {
  const prevVip = process.env.MATCH_FIT_CLIENT_VIP_STRIPE_PRICE_ID;
  const prevLegacy = process.env.STRIPE_PRICE_ID;

  afterEach(() => {
    if (prevVip === undefined) delete process.env.MATCH_FIT_CLIENT_VIP_STRIPE_PRICE_ID;
    else process.env.MATCH_FIT_CLIENT_VIP_STRIPE_PRICE_ID = prevVip;
    if (prevLegacy === undefined) delete process.env.STRIPE_PRICE_ID;
    else process.env.STRIPE_PRICE_ID = prevLegacy;
  });

  it("prefers MATCH_FIT_CLIENT_VIP_STRIPE_PRICE_ID over legacy STRIPE_PRICE_ID", () => {
    process.env.MATCH_FIT_CLIENT_VIP_STRIPE_PRICE_ID = "price_vip";
    process.env.STRIPE_PRICE_ID = "price_legacy";
    expect(resolveClientVipStripePriceId()).toBe("price_vip");
  });

  it("falls back to legacy STRIPE_PRICE_ID when VIP env is unset", () => {
    delete process.env.MATCH_FIT_CLIENT_VIP_STRIPE_PRICE_ID;
    process.env.STRIPE_PRICE_ID = "price_legacy";
    expect(resolveClientVipStripePriceId()).toBe("price_legacy");
  });

  it("returns null when neither env is set", () => {
    delete process.env.MATCH_FIT_CLIENT_VIP_STRIPE_PRICE_ID;
    delete process.env.STRIPE_PRICE_ID;
    expect(resolveClientVipStripePriceId()).toBeNull();
  });
});
