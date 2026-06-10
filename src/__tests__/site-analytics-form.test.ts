import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendEventMock } = vi.hoisted(() => ({
  sendEventMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/components/site-analytics-tracker", () => ({
  sendEvent: sendEventMock,
}));

import {
  bindFormFieldFocus,
  trackFormFieldFocus,
  trackFormSubmitAttempt,
  trackFormSubmitError,
  trackFormSubmitSuccess,
} from "@/lib/site-analytics-form";

const ctx = {
  path: "/client/sign-up",
  formId: "client_sign_up_form",
};

describe("site-analytics form helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tracks field focus with the field name as label", async () => {
    trackFormFieldFocus(ctx, "email");
    await Promise.resolve();

    expect(sendEventMock).toHaveBeenCalledWith({
      kind: "FORM_FIELD_FOCUS",
      path: "/client/sign-up",
      linkLabel: "email",
    });
  });

  it("tracks submit attempt and success with form id as fallback label", async () => {
    trackFormSubmitAttempt(ctx);
    trackFormSubmitSuccess(ctx);
    await Promise.resolve();

    expect(sendEventMock).toHaveBeenNthCalledWith(1, {
      kind: "FORM_SUBMIT_ATTEMPT",
      path: "/client/sign-up",
      linkLabel: "client_sign_up_form",
    });
    expect(sendEventMock).toHaveBeenNthCalledWith(2, {
      kind: "FORM_SUBMIT_SUCCESS",
      path: "/client/sign-up",
      linkLabel: "client_sign_up_form",
    });
  });

  it("truncates submit error labels to 200 characters", async () => {
    const longCode = "ERR_".repeat(100);
    trackFormSubmitError(ctx, longCode);
    await Promise.resolve();

    const payload = sendEventMock.mock.calls.at(-1)?.[0] as { linkLabel: string };
    expect(payload.linkLabel.length).toBe(200);
  });

  it("returns a reusable focus handler for form fields", async () => {
    const handler = bindFormFieldFocus(ctx, "password");

    handler({} as never);
    await Promise.resolve();

    expect(sendEventMock).toHaveBeenCalledWith({
      kind: "FORM_FIELD_FOCUS",
      path: "/client/sign-up",
      linkLabel: "password",
    });
  });
});
