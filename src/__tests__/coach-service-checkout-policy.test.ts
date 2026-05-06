import { describe, expect, it } from "vitest";
import { evaluateCoachServiceCheckoutPolicy, parseCoachServiceCheckoutContext } from "@/lib/coach-service-checkout-policy";

describe("coachServiceCheckoutPolicy", () => {
  it("parses checkout context query", () => {
    expect(parseCoachServiceCheckoutContext(undefined)).toBe("profile");
    expect(parseCoachServiceCheckoutContext(null)).toBe("profile");
    expect(parseCoachServiceCheckoutContext("CHAT")).toBe("chat");
    expect(parseCoachServiceCheckoutContext("chat")).toBe("chat");
  });

  it("requires an open chat for any purchase", () => {
    const r = evaluateCoachServiceCheckoutPolicy({
      checkoutContext: "chat",
      clientsCanPurchaseServicesFromProfile: false,
      officialChatStartedAt: null,
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("CONVERSATION_REQUIRED");
  });

  it("blocks profile checkout when trainer disabled profile purchase", () => {
    const r = evaluateCoachServiceCheckoutPolicy({
      checkoutContext: "profile",
      clientsCanPurchaseServicesFromProfile: false,
      officialChatStartedAt: new Date(),
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("PROFILE_CHECKOUT_DISABLED");
  });

  it("allows chat checkout when profile purchase disabled but chat is open", () => {
    const r = evaluateCoachServiceCheckoutPolicy({
      checkoutContext: "chat",
      clientsCanPurchaseServicesFromProfile: false,
      officialChatStartedAt: new Date(),
    });
    expect(r.allowed).toBe(true);
  });

  it("allows profile checkout when enabled and chat is open", () => {
    const r = evaluateCoachServiceCheckoutPolicy({
      checkoutContext: "profile",
      clientsCanPurchaseServicesFromProfile: true,
      officialChatStartedAt: new Date(),
    });
    expect(r.allowed).toBe(true);
  });
});
