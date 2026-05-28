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

import { logAdministratorAuditEvent } from "@/lib/administrator-audit-log";

describe("logAdministratorAuditEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdministratorAuditLogCreate.mockResolvedValue(undefined);
  });

  it("stores trimmed target username and request metadata", async () => {
    const req = new Request("https://example.test/admin", {
      headers: {
        "x-forwarded-for": "203.0.113.9, 198.51.100.2",
        "user-agent": "MatchFitBot/1.0",
      },
    });

    await logAdministratorAuditEvent({
      administratorId: "admin_12345",
      action: "IMPERSONATION_START",
      targetRole: "client",
      targetId: "client_12345",
      targetUsername: "  client-user  ",
      req,
    });

    expect(mockAdministratorAuditLogCreate).toHaveBeenCalledWith({
      data: {
        administratorId: "admin_12345",
        action: "IMPERSONATION_START",
        targetRole: "client",
        targetId: "client_12345",
        targetUsername: "client-user",
        ipAddress: "203.0.113.9",
        userAgent: "MatchFitBot/1.0",
      },
    });
  });

  it("falls back to x-real-ip and truncates overly long user-agent", async () => {
    const veryLongUserAgent = "A".repeat(700);
    const req = new Request("https://example.test/admin", {
      headers: {
        "x-real-ip": "198.51.100.10",
        "user-agent": veryLongUserAgent,
      },
    });

    await logAdministratorAuditEvent({
      administratorId: "admin_12345",
      action: "IMPERSONATION_END",
      targetRole: "trainer",
      targetId: "trainer_12345",
      targetUsername: "   ",
      req,
    });

    expect(mockAdministratorAuditLogCreate).toHaveBeenCalledWith({
      data: {
        administratorId: "admin_12345",
        action: "IMPERSONATION_END",
        targetRole: "trainer",
        targetId: "trainer_12345",
        targetUsername: undefined,
        ipAddress: "198.51.100.10",
        userAgent: veryLongUserAgent.slice(0, 512),
      },
    });
  });

  it("swallows prisma errors and logs to console", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockAdministratorAuditLogCreate.mockRejectedValueOnce(new Error("database down"));

    await expect(
      logAdministratorAuditEvent({
        administratorId: "admin_12345",
        action: "IMPERSONATION_END",
        targetRole: "trainer",
        targetId: "trainer_12345",
      }),
    ).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
