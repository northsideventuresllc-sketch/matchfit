import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearTestCookieJar, testCookieJar } from "@/test/next-cookie-jar";

const {
  mockAdministratorFindUnique,
  mockClientFindUnique,
  mockTrainerFindUnique,
  mockVerifyAdminSessionToken,
  mockSignAdminImpersonationToken,
  mockApplyAdminImpersonationToNextResponse,
  mockGetVerifiedAdminImpersonation,
  mockClearAdminImpersonationCookieOnNextResponse,
  mockVerifyTurnstileToken,
  mockLogAdministratorAuditEvent,
} = vi.hoisted(() => ({
  mockAdministratorFindUnique: vi.fn(),
  mockClientFindUnique: vi.fn(),
  mockTrainerFindUnique: vi.fn(),
  mockVerifyAdminSessionToken: vi.fn(),
  mockSignAdminImpersonationToken: vi.fn(),
  mockApplyAdminImpersonationToNextResponse: vi.fn(),
  mockGetVerifiedAdminImpersonation: vi.fn(),
  mockClearAdminImpersonationCookieOnNextResponse: vi.fn(),
  mockVerifyTurnstileToken: vi.fn(),
  mockLogAdministratorAuditEvent: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    administrator: {
      findUnique: mockAdministratorFindUnique,
    },
    client: {
      findUnique: mockClientFindUnique,
    },
    trainer: {
      findUnique: mockTrainerFindUnique,
    },
  },
}));

vi.mock("@/lib/session", () => ({
  ADMIN_SESSION_COOKIE: "mf_admin_session",
  CLIENT_SESSION_COOKIE: "mf_client_session",
  TRAINER_SESSION_COOKIE: "mf_trainer_session",
  LOGIN_CHALLENGE_COOKIE: "mf_login_challenge",
  TRAINER_LOGIN_CHALLENGE_COOKIE: "mf_trainer_login_challenge",
  verifyAdminSessionToken: mockVerifyAdminSessionToken,
  signAdminImpersonationToken: mockSignAdminImpersonationToken,
  applyAdminImpersonationToNextResponse: mockApplyAdminImpersonationToNextResponse,
  getVerifiedAdminImpersonation: mockGetVerifiedAdminImpersonation,
  clearAdminImpersonationCookieOnNextResponse: mockClearAdminImpersonationCookieOnNextResponse,
}));

vi.mock("@/lib/turnstile-verify", () => ({
  verifyTurnstileToken: mockVerifyTurnstileToken,
}));

vi.mock("@/lib/administrator-audit-log", () => ({
  logAdministratorAuditEvent: mockLogAdministratorAuditEvent,
}));

import { POST as startImpersonation } from "@/app/api/admin/impersonate/route";
import { POST as stopImpersonation } from "@/app/api/admin/stop-impersonate/route";

function setAdminCookie(): void {
  testCookieJar.set("mf_admin_session", "admin_session_token");
}

function postJson(url: string, body: Record<string, unknown>): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin impersonation routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTestCookieJar();

    mockVerifyAdminSessionToken.mockResolvedValue({
      adminId: "admin_12345",
      testMode: false,
      rememberMe: true,
    });
    mockVerifyTurnstileToken.mockResolvedValue({ ok: true });
    mockAdministratorFindUnique.mockResolvedValue({ id: "admin_12345" });
    mockClientFindUnique.mockResolvedValue({
      id: "client_12345",
      username: "client-user",
      deidentifiedAt: null,
    });
    mockTrainerFindUnique.mockResolvedValue({
      id: "trainer_12345",
      username: "trainer-user",
      deidentifiedAt: null,
    });
    mockSignAdminImpersonationToken.mockResolvedValue("impersonation_token");
    mockGetVerifiedAdminImpersonation.mockResolvedValue(null);
    mockLogAdministratorAuditEvent.mockResolvedValue(undefined);
  });

  describe("POST /api/admin/impersonate", () => {
    it("returns 401 when no admin session cookie is present", async () => {
      const res = await startImpersonation(
        postJson("https://example.test/api/admin/impersonate", {
          role: "client",
          userId: "client_12345",
        }),
      );

      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
      expect(mockVerifyAdminSessionToken).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid request body", async () => {
      setAdminCookie();

      const res = await startImpersonation(
        postJson("https://example.test/api/admin/impersonate", {
          role: "client",
          userId: "short",
        }),
      );

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({ error: "Invalid request." });
      expect(mockVerifyTurnstileToken).not.toHaveBeenCalled();
    });

    it("returns turnstile error status and message when verification fails", async () => {
      setAdminCookie();
      mockVerifyTurnstileToken.mockResolvedValueOnce({
        ok: false,
        status: 429,
        error: "Captcha verification failed.",
      });

      const req = postJson("https://example.test/api/admin/impersonate", {
        role: "client",
        userId: "client_12345",
        turnstileToken: "turnstile_token",
      });
      const res = await startImpersonation(req);

      expect(mockVerifyTurnstileToken).toHaveBeenCalledWith("turnstile_token", req);
      expect(res.status).toBe(429);
      await expect(res.json()).resolves.toEqual({ error: "Captcha verification failed." });
      expect(mockAdministratorFindUnique).not.toHaveBeenCalled();
    });

    it("returns 404 when target client is missing", async () => {
      setAdminCookie();
      mockClientFindUnique.mockResolvedValueOnce(null);

      const res = await startImpersonation(
        postJson("https://example.test/api/admin/impersonate", {
          role: "client",
          userId: "client_12345",
        }),
      );

      expect(res.status).toBe(404);
      await expect(res.json()).resolves.toEqual({ error: "Client not found." });
    });

    it("creates impersonation token and logs audit event for client impersonation", async () => {
      setAdminCookie();
      const req = postJson("https://example.test/api/admin/impersonate", {
        role: "client",
        userId: "client_12345",
      });

      const res = await startImpersonation(req);

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ ok: true, next: "/client/dashboard" });
      expect(mockSignAdminImpersonationToken).toHaveBeenCalledWith({
        adminId: "admin_12345",
        role: "client",
        targetId: "client_12345",
      });
      expect(mockApplyAdminImpersonationToNextResponse).toHaveBeenCalledTimes(1);
      expect(mockApplyAdminImpersonationToNextResponse.mock.calls[0]?.[1]).toBe("impersonation_token");
      expect(mockLogAdministratorAuditEvent).toHaveBeenCalledWith({
        administratorId: "admin_12345",
        action: "IMPERSONATION_START",
        targetRole: "client",
        targetId: "client_12345",
        targetUsername: "client-user",
        req,
      });
    });

    it("creates impersonation token and trainer redirect for trainer role", async () => {
      setAdminCookie();

      const res = await startImpersonation(
        postJson("https://example.test/api/admin/impersonate", {
          role: "trainer",
          userId: "trainer_12345",
        }),
      );

      expect(mockTrainerFindUnique).toHaveBeenCalledWith({
        where: { id: "trainer_12345" },
        select: { id: true, username: true, deidentifiedAt: true },
      });
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ ok: true, next: "/trainer/dashboard" });
    });

    it("returns 500 when route throws unexpectedly", async () => {
      setAdminCookie();
      mockSignAdminImpersonationToken.mockRejectedValueOnce(new Error("signing failed"));

      const res = await startImpersonation(
        postJson("https://example.test/api/admin/impersonate", {
          role: "trainer",
          userId: "trainer_12345",
        }),
      );

      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toEqual({ error: "Could not start impersonation." });
    });
  });

  describe("POST /api/admin/stop-impersonate", () => {
    it("returns 401 when no valid admin session exists", async () => {
      mockVerifyAdminSessionToken.mockResolvedValueOnce(null);
      setAdminCookie();

      const res = await stopImpersonation(
        new Request("https://example.test/api/admin/stop-impersonate", { method: "POST" }),
      );

      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
    });

    it("clears impersonation cookie and skips audit log when no impersonation context exists", async () => {
      setAdminCookie();
      mockGetVerifiedAdminImpersonation.mockResolvedValueOnce(null);

      const res = await stopImpersonation(
        new Request("https://example.test/api/admin/stop-impersonate", { method: "POST" }),
      );

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ ok: true, next: "/admin" });
      expect(mockClearAdminImpersonationCookieOnNextResponse).toHaveBeenCalledTimes(1);
      expect(mockLogAdministratorAuditEvent).not.toHaveBeenCalled();
    });

    it("logs trainer impersonation end with resolved target username", async () => {
      setAdminCookie();
      const req = new Request("https://example.test/api/admin/stop-impersonate", { method: "POST" });
      mockGetVerifiedAdminImpersonation.mockResolvedValueOnce({
        adminId: "admin_12345",
        role: "trainer",
        targetId: "trainer_12345",
        testMode: false,
      });
      mockTrainerFindUnique.mockResolvedValueOnce({ username: "coach-name" });

      const res = await stopImpersonation(req);

      expect(res.status).toBe(200);
      expect(mockTrainerFindUnique).toHaveBeenCalledWith({
        where: { id: "trainer_12345" },
        select: { username: true },
      });
      expect(mockLogAdministratorAuditEvent).toHaveBeenCalledWith({
        administratorId: "admin_12345",
        action: "IMPERSONATION_END",
        targetRole: "trainer",
        targetId: "trainer_12345",
        targetUsername: "coach-name",
        req,
      });
    });

    it("returns 500 when stop impersonation throws", async () => {
      setAdminCookie();
      mockGetVerifiedAdminImpersonation.mockRejectedValueOnce(new Error("bad state"));

      const res = await stopImpersonation(
        new Request("https://example.test/api/admin/stop-impersonate", { method: "POST" }),
      );

      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toEqual({ error: "Could not end impersonation." });
    });
  });
});
