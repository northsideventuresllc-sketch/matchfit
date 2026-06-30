import { afterEach, describe, expect, it } from "vitest";
import {
  getClientVipStripePriceId,
  isClientVipSubscription,
  subscriptionUsesClientVipPrice,
} from "@/lib/client-vip-subscription";
import type Stripe from "stripe";

describe("client-vip-subscription price detection", () => {
  const prevVip = process.env.MATCH_FIT_CLIENT_VIP_STRIPE_PRICE_ID;

  afterEach(() => {
    if (prevVip === undefined) delete process.env.MATCH_FIT_CLIENT_VIP_STRIPE_PRICE_ID;
    else process.env.MATCH_FIT_CLIENT_VIP_STRIPE_PRICE_ID = prevVip;
  });

  it("matches VIP subscriptions by metadata purpose", () => {
    const sub = { metadata: { purpose: "client_vip" }, items: { data: [] } } as Stripe.Subscription;
    expect(isClientVipSubscription(sub)).toBe(true);
  });

  it("matches VIP subscriptions by configured price id when metadata is missing", () => {
    process.env.MATCH_FIT_CLIENT_VIP_STRIPE_PRICE_ID = "price_vip_test";
    const sub = {
      metadata: {},
      items: { data: [{ price: { id: "price_vip_test" } }] },
    } as Stripe.Subscription;
    expect(subscriptionUsesClientVipPrice(sub)).toBe(true);
    expect(isClientVipSubscription(sub)).toBe(true);
  });

  it("does not treat unrelated subscriptions as VIP", () => {
    process.env.MATCH_FIT_CLIENT_VIP_STRIPE_PRICE_ID = "price_vip_test";
    const sub = {
      metadata: { purpose: "legacy_membership" },
      items: { data: [{ price: { id: "price_other" } }] },
    } as Stripe.Subscription;
    expect(isClientVipSubscription(sub)).toBe(false);
  });

  it("exposes configured VIP price id via helper", () => {
    process.env.MATCH_FIT_CLIENT_VIP_STRIPE_PRICE_ID = "price_vip_test";
    expect(getClientVipStripePriceId()).toBe("price_vip_test");
  });
});
