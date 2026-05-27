import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  sendMatchFitWelcomeEmailMock,
  sendMatchFitWelcomeMvpPreviewEmailMock,
  publicApiErrorFromUnknownMock,
} = vi.hoisted(() => ({
  sendMatchFitWelcomeEmailMock: vi.fn(),
  sendMatchFitWelcomeMvpPreviewEmailMock: vi.fn(),
  publicApiErrorFromUnknownMock: vi.fn(),
}));

vi.mock("@/lib/match-fit-welcome-email", () => ({
  sendMatchFitWelcomeEmail: sendMatchFitWelcomeEmailMock,
}));

vi.mock("@/lib/match-fit-welcome-mvp-preview-email", () => ({
  MVP_WELCOME_TEST_RECIPIENT: "preview-inbox@example.com",
  sendMatchFitWelcomeMvpPreviewEmail: sendMatchFitWelcomeMvpPreviewEmailMock,
}));

vi.mock("@/lib/public-api-error", () => ({
  publicApiErrorFromUnknown: publicApiErrorFromUnknownMock,
}));

import { welcomeEmailPostHandler } from "@/lib/welcome-email-post-handler";
import { POST as welcomeEmailRoutePost, dynamic as welcomeEmailRouteDynamic } from "@/app/api/welcome-email/route";
import { POST as sendWelcomeRoutePost, dynamic as sendWelcomeRouteDynamic } from "@/app/api/send-welcome/route";

function jsonRequest(url: string, body: unknown, authorization?: string): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (authorization) {
    headers.set("authorization", authorization);
  }
  return new Request(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("welcome email routes", () => {
  const envBefore = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBefore };
    vi.clearAllMocks();
    publicApiErrorFromUnknownMock.mockReturnValue({
      message: "Could not send welcome email.",
      status: 500,
    });
  });

  afterEach(() => {
    process.env = { ...envBefore };
  });

  it("keeps both welcome routes dynamic", () => {
    expect(welcomeEmailRouteDynamic).toBe("force-dynamic");
    expect(sendWelcomeRouteDynamic).toBe("force-dynamic");
  });

  it("re-exports POST /api/welcome-email from shared handler", () => {
    expect(welcomeEmailRoutePost).toBe(welcomeEmailPostHandler);
  });

  describe("welcomeEmailPostHandler", () => {
    it("returns 503 when route secret is not configured", async () => {
      delete process.env.MATCHFIT_WELCOME_EMAIL_SECRET;

      const response = await welcomeEmailPostHandler(
        jsonRequest("https://example.test/api/welcome-email", { email: "member@example.com" }),
      );

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error: "Welcome email route is not configured.",
      });
      expect(sendMatchFitWelcomeEmailMock).not.toHaveBeenCalled();
    });

    it("returns 401 when bearer secret is invalid", async () => {
      process.env.MATCHFIT_WELCOME_EMAIL_SECRET = "1234567890abcdef";

      const response = await welcomeEmailPostHandler(
        jsonRequest("https://example.test/api/welcome-email", { email: "member@example.com" }, "Bearer wrong"),
      );

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
    });

    it("returns 400 for invalid JSON body", async () => {
      process.env.MATCHFIT_WELCOME_EMAIL_SECRET = "1234567890abcdef";

      const response = await welcomeEmailPostHandler(
        jsonRequest(
          "https://example.test/api/welcome-email",
          { email: "not-an-email", firstName: "" },
          "Bearer 1234567890abcdef",
        ),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Invalid body. Expected { email, firstName? }.",
      });
      expect(sendMatchFitWelcomeEmailMock).not.toHaveBeenCalled();
    });

    it("sends welcome email for valid authenticated requests", async () => {
      process.env.MATCHFIT_WELCOME_EMAIL_SECRET = "1234567890abcdef";
      sendMatchFitWelcomeEmailMock.mockResolvedValue(undefined);

      const response = await welcomeEmailPostHandler(
        jsonRequest(
          "https://example.test/api/welcome-email",
          { email: "member@example.com", firstName: "  Taylor " },
          "Bearer 1234567890abcdef",
        ),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ ok: true });
      expect(sendMatchFitWelcomeEmailMock).toHaveBeenCalledWith({
        to: "member@example.com",
        firstName: "Taylor",
      });
    });

    it("maps internal failures through publicApiErrorFromUnknown", async () => {
      process.env.MATCHFIT_WELCOME_EMAIL_SECRET = "1234567890abcdef";
      sendMatchFitWelcomeEmailMock.mockRejectedValue(new Error("boom"));
      publicApiErrorFromUnknownMock.mockReturnValue({
        message: "Delivery rejected.",
        status: 422,
      });

      const response = await welcomeEmailPostHandler(
        jsonRequest("https://example.test/api/welcome-email", { email: "member@example.com" }, "Bearer 1234567890abcdef"),
      );

      expect(publicApiErrorFromUnknownMock).toHaveBeenCalled();
      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual({ error: "Delivery rejected." });
    });
  });

  describe("POST /api/send-welcome", () => {
    it("allows unauthenticated development requests", async () => {
      process.env.NODE_ENV = "development";
      sendMatchFitWelcomeMvpPreviewEmailMock.mockResolvedValue(undefined);

      const response = await sendWelcomeRoutePost(new Request("https://example.test/api/send-welcome", { method: "POST" }));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        ok: true,
        to: "preview-inbox@example.com",
        message: "Welcome email sent.",
      });
      expect(sendMatchFitWelcomeMvpPreviewEmailMock).toHaveBeenCalledTimes(1);
    });

    it("returns 404 in production when secret is missing", async () => {
      process.env.NODE_ENV = "production";
      delete process.env.MATCHFIT_SEND_WELCOME_PREVIEW_SECRET;

      const response = await sendWelcomeRoutePost(new Request("https://example.test/api/send-welcome", { method: "POST" }));

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: "Not found." });
      expect(sendMatchFitWelcomeMvpPreviewEmailMock).not.toHaveBeenCalled();
    });

    it("returns 404 in production when bearer token mismatches", async () => {
      process.env.NODE_ENV = "production";
      process.env.MATCHFIT_SEND_WELCOME_PREVIEW_SECRET = "1234567890abcdef";

      const response = await sendWelcomeRoutePost(
        new Request("https://example.test/api/send-welcome", {
          method: "POST",
          headers: { authorization: "Bearer wrong" },
        }),
      );

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: "Not found." });
      expect(sendMatchFitWelcomeMvpPreviewEmailMock).not.toHaveBeenCalled();
    });

    it("accepts production requests with the expected bearer token", async () => {
      process.env.NODE_ENV = "production";
      process.env.MATCHFIT_SEND_WELCOME_PREVIEW_SECRET = "1234567890abcdef";
      sendMatchFitWelcomeMvpPreviewEmailMock.mockResolvedValue(undefined);

      const response = await sendWelcomeRoutePost(
        new Request("https://example.test/api/send-welcome", {
          method: "POST",
          headers: { authorization: "Bearer 1234567890abcdef" },
        }),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        ok: true,
        to: "preview-inbox@example.com",
        message: "Welcome email sent.",
      });
      expect(sendMatchFitWelcomeMvpPreviewEmailMock).toHaveBeenCalledTimes(1);
    });

    it("maps failures through publicApiErrorFromUnknown", async () => {
      process.env.NODE_ENV = "development";
      sendMatchFitWelcomeMvpPreviewEmailMock.mockRejectedValue(new Error("send failed"));
      publicApiErrorFromUnknownMock.mockReturnValue({
        message: "Could not deliver welcome preview.",
        status: 502,
      });

      const response = await sendWelcomeRoutePost(new Request("https://example.test/api/send-welcome", { method: "POST" }));

      expect(publicApiErrorFromUnknownMock).toHaveBeenCalled();
      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toEqual({
        error: "Could not deliver welcome preview.",
      });
    });
  });
});
