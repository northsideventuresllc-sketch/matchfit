import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAdministratorAuditLogCreate } = vi.hoisted(() => ({
  mockAdministratorAuditLogCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    administratorAuditLog: {
      create: mockAdministratorAuditLogCreate,
    },
  },
}));

import { logAdministratorAuditEvent } from "./administrator-audit-log";

describe("logAdministratorAuditEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdministratorAuditLogCreate.mockResolvedValue({});
  });

  it("logs request metadata, trims username, and prefers x-forwarded-for", async () => {
    const request = new Request("https://example.test", {
      headers: {
        "x-forwarded-for": "203.0.113.8, 70.41.3.18",
        "x-real-ip": "192.0.2.9",
        "user-agent": "MatchFitAdmin/1.0",
      },
    });

    await logAdministratorAuditEvent({
      administratorId: "admin_1",
      action: "IMPERSONATION_START",
      targetRole: "client",
      targetId: "client_1",
      targetUsername: "  test_client  ",
      req: request,
    });

    expect(mockAdministratorAuditLogCreate).toHaveBeenCalledWith({
      data: {
        administratorId: "admin_1",
        action: "IMPERSONATION_START",
        targetRole: "client",
        targetId: "client_1",
        targetUsername: "test_client",
        ipAddress: "203.0.113.8",
        userAgent: "MatchFitAdmin/1.0",
      },
    });
  });

  it("truncates user-agent to 512 chars and omits blank usernames", async () => {
    const userAgent = "a".repeat(600);
    const request = new Request("https://example.test", {
      headers: {
        "x-real-ip": "192.0.2.20",
        "user-agent": userAgent,
      },
    });

    await logAdministratorAuditEvent({
      administratorId: "admin_1",
      action: "IMPERSONATION_END",
      targetRole: "trainer",
      targetId: "trainer_1",
      targetUsername: "   ",
      req: request,
    });

    const createArg = mockAdministratorAuditLogCreate.mock.calls[0]?.[0];
    expect(createArg.data.ipAddress).toBe("192.0.2.20");
    expect(createArg.data.targetUsername).toBeUndefined();
    expect(createArg.data.userAgent).toHaveLength(512);
  });

  it("does not throw when persistence fails", async () => {
    const failure = new Error("insert failed");
    mockAdministratorAuditLogCreate.mockRejectedValueOnce(failure);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      logAdministratorAuditEvent({
        administratorId: "admin_1",
        action: "IMPERSONATION_START",
        targetRole: "client",
        targetId: "client_1",
      }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith("[administrator audit log]", failure);
    errorSpy.mockRestore();
  });
});
