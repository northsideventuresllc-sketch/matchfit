import { describe, expect, it } from "vitest";
import { metaCapiEventNameForServerEvent } from "@/lib/server-conversion-tracking";

describe("server-conversion-tracking", () => {
  it("maps internal funnel events to Meta standard CAPI names", () => {
    expect(metaCapiEventNameForServerEvent("client_signup_complete")).toBe("Subscribe");
    expect(metaCapiEventNameForServerEvent("trainer_signup_started")).toBe("Lead");
    expect(metaCapiEventNameForServerEvent("trainer_tos_accepted")).toBe("CompleteRegistration");
    expect(metaCapiEventNameForServerEvent("trainer_profile_complete")).toBe("CompleteRegistration");
  });

  it("passes through unknown events unchanged", () => {
    expect(metaCapiEventNameForServerEvent("custom_operator_event")).toBe("custom_operator_event");
  });
});
