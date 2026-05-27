import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MATCH_FIT_NOREPLY_FROM,
  RESEND_DEV_INBOX,
  RESEND_ONBOARDING_FROM,
  httpStatusFromResendError,
  matchFitProductionFromHeader,
  sendResendEmail,
} from "@/lib/resend-client";

const fetchMock = vi.fn();

describe("resend-client", () => {
  const envBefore = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBefore };
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    process.env = { ...envBefore };
    vi.unstubAllGlobals();
  });

  describe("matchFitProductionFromHeader", () => {
    it("returns default Match Fit noreply sender when env is missing", () => {
      delete process.env.RESEND_FROM_EMAIL;
      expect(matchFitProductionFromHeader()).toBe(MATCH_FIT_NOREPLY_FROM);
    });

    it("uses trimmed RESEND_FROM_EMAIL override when provided", () => {
      process.env.RESEND_FROM_EMAIL = "  Match Fit <ops@match-fit.net>  ";
      expect(matchFitProductionFromHeader()).toBe("Match Fit <ops@match-fit.net>");
    });
  });

  describe("sendResendEmail", () => {
    it("throws when RESEND_API_KEY is not set", async () => {
      delete process.env.RESEND_API_KEY;

      await expect(
        sendResendEmail({
          to: "person@example.com",
          subject: "Test",
          text: "Body",
        }),
      ).rejects.toThrow("RESEND_API_KEY is not set.");
    });

    it("enforces development inbox safety redirect and onboarding sender", async () => {
      process.env.RESEND_API_KEY = "test-key";
      process.env.NODE_ENV = "development";
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "msg_123" }), { status: 200 }));

      const id = await sendResendEmail({
        to: "User@Example.com",
        subject: "Safety Test",
        text: "Hello world",
        html: "<p>Hello world</p>",
        from: "Custom <from@example.com>",
        replyTo: "  support@example.com ",
      });

      expect(id).toBe("msg_123");
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.resend.com/emails");

      const payload = JSON.parse(String(init.body)) as Record<string, string>;
      expect(payload.from).toBe(RESEND_ONBOARDING_FROM);
      expect(payload.to).toBe(RESEND_DEV_INBOX);
      expect(payload.subject).toBe("Safety Test");
      expect(payload.reply_to).toBe("support@example.com");
      expect(payload.text).toContain("Development safety — intended recipient: User@Example.com");
      expect(payload.html).toContain("<strong>Development safety — intended recipient:</strong>");
    });

    it("does not rewrite recipient when already sending to dev inbox", async () => {
      process.env.RESEND_API_KEY = "test-key";
      process.env.NODE_ENV = "development";
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "msg_456" }), { status: 200 }));

      await sendResendEmail({
        to: `  ${RESEND_DEV_INBOX.toUpperCase()}  `,
        subject: "No Redirect",
        text: "Plain text",
      });

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const payload = JSON.parse(String(init.body)) as Record<string, string>;
      expect(payload.to).toBe(RESEND_DEV_INBOX.toUpperCase());
      expect(payload.text).toBe("Plain text");
    });

    it("sends unmodified payload in non-development environments", async () => {
      process.env.RESEND_API_KEY = "test-key";
      process.env.NODE_ENV = "production";
      fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

      const id = await sendResendEmail({
        to: "  trainer@example.com  ",
        subject: "Production Mail",
        text: "Body",
        from: " Match Fit <alerts@match-fit.net> ",
        replyTo: "   ",
      });

      expect(id).toBeUndefined();

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const payload = JSON.parse(String(init.body)) as Record<string, string>;
      expect(payload.from).toBe("Match Fit <alerts@match-fit.net>");
      expect(payload.to).toBe("trainer@example.com");
      expect(payload.reply_to).toBeUndefined();
    });

    it("throws Resend HTTP status errors", async () => {
      process.env.RESEND_API_KEY = "test-key";
      fetchMock.mockResolvedValue(new Response("Invalid payload", { status: 422 }));

      await expect(
        sendResendEmail({
          to: "person@example.com",
          subject: "Test",
          text: "Body",
        }),
      ).rejects.toThrow("Resend HTTP 422: Invalid payload");
    });
  });

  describe("httpStatusFromResendError", () => {
    it("maps auth errors to 403", () => {
      expect(httpStatusFromResendError("Resend HTTP 401: Unauthorized")).toBe(403);
      expect(httpStatusFromResendError("Resend HTTP 403: Forbidden")).toBe(403);
    });

    it("maps unprocessable errors to 422", () => {
      expect(httpStatusFromResendError("Resend HTTP 422: Invalid recipient")).toBe(422);
    });

    it("passes through other 4xx errors and collapses 5xx to 500", () => {
      expect(httpStatusFromResendError("Resend HTTP 429: Too many requests")).toBe(429);
      expect(httpStatusFromResendError("Resend HTTP 503: Service unavailable")).toBe(500);
    });

    it("returns 500 when message has no Resend status code", () => {
      expect(httpStatusFromResendError("Unknown error")).toBe(500);
    });
  });
});
