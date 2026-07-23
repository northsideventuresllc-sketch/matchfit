import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Dual-auth (admin cookie OR X-Match-Fit-Service-Token) for the outreach routes the
 * AXON Telegram bridge calls server-to-server. The real `require-service-token` module
 * is intentionally NOT mocked so its fail-closed logic is under test; only the admin
 * session and the route's data dependencies are stubbed.
 */

const {
  mockRequireAdminSession,
  mockQueueOutreachDispatch,
  mockEnsureOutreachHubSchema,
} = vi.hoisted(() => ({
  mockRequireAdminSession: vi.fn(),
  mockQueueOutreachDispatch: vi.fn(),
  mockEnsureOutreachHubSchema: vi.fn(),
}));

vi.mock("@/lib/require-admin", () => ({
  requireAdminSession: mockRequireAdminSession,
}));

vi.mock("@/lib/outreach-dispatch", () => ({
  queueOutreachDispatch: mockQueueOutreachDispatch,
}));

vi.mock("@/lib/ensure-outreach-hub-schema", () => ({
  ensureOutreachHubSchema: mockEnsureOutreachHubSchema,
  isMissingOutreachHubSchemaError: () => false,
}));

import { POST } from "@/app/api/admin/outreach/dispatch/queue/route";
import {
  hasValidServiceToken,
  resolveOutreachActor,
  SERVICE_ACTOR_ADMIN_ID,
  MATCH_FIT_SERVICE_TOKEN_HEADER,
} from "@/lib/require-service-token";

const VALID_TOKEN = "svc_test_token_abc123";
const QUEUE_URL = "https://matchfit.test/api/admin/outreach/dispatch/queue";

function queueRequest(headers: Record<string, string> = {}): Request {
  return new Request(QUEUE_URL, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ leadIds: [{ id: "lead_1", platform: "instagram" }] }),
  });
}

describe("outreach service-token dual auth", () => {
  const ORIGINAL = process.env.MATCH_FIT_SERVICE_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureOutreachHubSchema.mockResolvedValue(undefined);
    mockQueueOutreachDispatch.mockResolvedValue({ ok: true });
    process.env.MATCH_FIT_SERVICE_TOKEN = VALID_TOKEN;
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.MATCH_FIT_SERVICE_TOKEN;
    else process.env.MATCH_FIT_SERVICE_TOKEN = ORIGINAL;
  });

  describe("hasValidServiceToken (fail-closed)", () => {
    it("returns false when the env var is unset even if a header is sent", () => {
      delete process.env.MATCH_FIT_SERVICE_TOKEN;
      const req = queueRequest({ [MATCH_FIT_SERVICE_TOKEN_HEADER]: VALID_TOKEN });
      expect(hasValidServiceToken(req)).toBe(false);
    });

    it("returns false when the header is missing", () => {
      expect(hasValidServiceToken(queueRequest())).toBe(false);
    });

    it("returns false when the header does not match", () => {
      const req = queueRequest({ [MATCH_FIT_SERVICE_TOKEN_HEADER]: "wrong" });
      expect(hasValidServiceToken(req)).toBe(false);
    });

    it("returns true for an exact match", () => {
      const req = queueRequest({ [MATCH_FIT_SERVICE_TOKEN_HEADER]: VALID_TOKEN });
      expect(hasValidServiceToken(req)).toBe(true);
    });
  });

  describe("resolveOutreachActor", () => {
    it("yields the service actor for a valid token WITHOUT consulting the admin session", async () => {
      const req = queueRequest({ [MATCH_FIT_SERVICE_TOKEN_HEADER]: VALID_TOKEN });
      const actor = await resolveOutreachActor(req);
      expect(actor).toEqual({ adminId: SERVICE_ACTOR_ADMIN_ID, via: "service_token" });
      expect(mockRequireAdminSession).not.toHaveBeenCalled();
    });

    it("falls back to the admin session when no token is present", async () => {
      mockRequireAdminSession.mockResolvedValueOnce({ adminId: "admin_9", testMode: false, rememberMe: true });
      const actor = await resolveOutreachActor(queueRequest());
      expect(actor).toEqual({ adminId: "admin_9", via: "admin_session" });
    });

    it("returns null when neither a valid token nor a session is present", async () => {
      mockRequireAdminSession.mockResolvedValueOnce(null);
      const actor = await resolveOutreachActor(queueRequest({ [MATCH_FIT_SERVICE_TOKEN_HEADER]: "wrong" }));
      expect(actor).toBeNull();
    });
  });

  describe("POST /api/admin/outreach/dispatch/queue", () => {
    it("succeeds with a valid service token and NO session cookie", async () => {
      mockRequireAdminSession.mockResolvedValue(null); // no cookie at all
      const res = await POST(queueRequest({ [MATCH_FIT_SERVICE_TOKEN_HEADER]: VALID_TOKEN }));
      expect(res.status).toBe(200);
      expect(mockRequireAdminSession).not.toHaveBeenCalled();
      expect(mockQueueOutreachDispatch).toHaveBeenCalledWith({
        leads: [{ id: "lead_1", platform: "instagram" }],
        adminId: SERVICE_ACTOR_ADMIN_ID,
      });
    });

    it("returns 401 with a wrong token and no cookie", async () => {
      mockRequireAdminSession.mockResolvedValue(null);
      const res = await POST(queueRequest({ [MATCH_FIT_SERVICE_TOKEN_HEADER]: "nope" }));
      expect(res.status).toBe(401);
      expect(mockQueueOutreachDispatch).not.toHaveBeenCalled();
    });

    it("returns 401 with no token and no cookie", async () => {
      mockRequireAdminSession.mockResolvedValue(null);
      const res = await POST(queueRequest());
      expect(res.status).toBe(401);
      expect(mockQueueOutreachDispatch).not.toHaveBeenCalled();
    });

    it("returns 401 when the env secret is unset and a token header is spoofed (fail-closed)", async () => {
      delete process.env.MATCH_FIT_SERVICE_TOKEN;
      mockRequireAdminSession.mockResolvedValue(null);
      const res = await POST(queueRequest({ [MATCH_FIT_SERVICE_TOKEN_HEADER]: VALID_TOKEN }));
      expect(res.status).toBe(401);
      expect(mockQueueOutreachDispatch).not.toHaveBeenCalled();
    });

    it("still honors the existing cookie-only path unchanged (no token header)", async () => {
      mockRequireAdminSession.mockResolvedValue({ adminId: "admin_7", testMode: false, rememberMe: true });
      const res = await POST(queueRequest());
      expect(res.status).toBe(200);
      expect(mockRequireAdminSession).toHaveBeenCalledTimes(1);
      expect(mockQueueOutreachDispatch).toHaveBeenCalledWith({
        leads: [{ id: "lead_1", platform: "instagram" }],
        adminId: "admin_7",
      });
    });
  });
});
