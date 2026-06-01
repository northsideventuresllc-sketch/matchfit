import { describe, expect, it } from "vitest";
import { resolveSignupFunnelFromPath } from "./meta-pixel-funnel";

describe("resolveSignupFunnelFromPath", () => {
  it("returns client sign-up step", () => {
    expect(resolveSignupFunnelFromPath("/client/sign-up")).toMatchObject({
      funnel: "client",
      step_id: "sign_up_page",
    });
  });

  it("returns trainer onboarding step", () => {
    expect(resolveSignupFunnelFromPath("/trainer/onboarding")).toMatchObject({
      funnel: "trainer",
      step_id: "onboarding",
    });
  });

  it("aliases trainer sign-up path", () => {
    expect(resolveSignupFunnelFromPath("/trainer/sign-up")).toMatchObject({
      funnel: "trainer",
      step_id: "sign_up_page",
    });
  });

  it("returns null for unrelated routes", () => {
    expect(resolveSignupFunnelFromPath("/privacy")).toBeNull();
    expect(resolveSignupFunnelFromPath("/")).toBeNull();
  });

  it("strips query strings", () => {
    expect(resolveSignupFunnelFromPath("/client/subscribe?canceled=1")).toMatchObject({
      step_id: "subscription_offer",
    });
  });
});
