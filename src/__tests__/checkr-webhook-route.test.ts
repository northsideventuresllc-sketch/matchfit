import { createHmac } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockTrainerProfileFindFirst,
  mockTrainerProfileUpdate,
  mockRecordCheckrBackgroundCheckPaid,
  mockMaybeActivateTrainerDashboard,
} = vi.hoisted(() => ({
  mockTrainerProfileFindFirst: vi.fn(),
  mockTrainerProfileUpdate: vi.fn(),
  mockRecordCheckrBackgroundCheckPaid: vi.fn(),
  mockMaybeActivateTrainerDashboard: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerProfile: {
      findFirst: mockTrainerProfileFindFirst,
      update: mockTrainerProfileUpdate,
    },
  },
}));

vi.mock("@/lib/checkr", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/checkr")>();
  return {
    ...actual,
    recordCheckrBackgroundCheckPaid: mockRecordCheckrBackgroundCheckPaid,
  };
});

vi.mock("@/lib/trainer-onboarding-dashboard", () => ({
  maybeActivateTrainerDashboard: mockMaybeActivateTrainerDashboard,
}));

import { POST, dynamic } from "@/app/api/webhooks/checkr/route";

function signedWebhookRequest(body: string, secret: string): Request {
  const signature = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  return new Request("https://example.test/api/webhooks/checkr", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Checkr-Signature": signature,
    },
    body,
  });
}

describe("POST /api/webhooks/checkr", () => {
  const previousSecret = process.env.CHECKR_WEBHOOK_SECRET;
  const secret = "checkr-webhook-test-secret";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CHECKR_WEBHOOK_SECRET = secret;
    mockRecordCheckrBackgroundCheckPaid.mockResolvedValue(undefined);
    mockTrainerProfileUpdate.mockResolvedValue({});
    mockMaybeActivateTrainerDashboard.mockResolvedValue(undefined);
  });

  afterAll(() => {
    if (previousSecret === undefined) delete process.env.CHECKR_WEBHOOK_SECRET;
    else process.env.CHECKR_WEBHOOK_SECRET = previousSecret;
  });

  it("is configured as force-dynamic", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("returns 401 for invalid signatures", async () => {
    const body = JSON.stringify({ type: "report.completed", data: { object: { amount: 4900, status: "clear" } } });
    const res = await POST(
      new Request("https://example.test/api/webhooks/checkr", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Checkr-Signature": "bad" },
        body,
      }),
    );
    expect(res.status).toBe(401);
  });

  it("approves trainer when report maps via mf_trainer package prefix", async () => {
    const body = JSON.stringify({
      type: "report.completed",
      data: {
        object: {
          id: "rep_abc",
          candidate_id: "cand_abc",
          package: "mf_trainer:trainer_99",
          status: "clear",
          amount: 4900,
        },
      },
    });

    const res = await POST(signedWebhookRequest(body, secret));

    expect(res.status).toBe(200);
    expect(mockRecordCheckrBackgroundCheckPaid).toHaveBeenCalledWith({
      trainerId: "trainer_99",
      vendorPaidCents: 4900,
      reportId: "rep_abc",
      candidateId: "cand_abc",
    });
    expect(mockTrainerProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { trainerId: "trainer_99" },
        data: expect.objectContaining({
          backgroundCheckStatus: "APPROVED",
          backgroundCheckReviewStatus: "APPROVED",
        }),
      }),
    );
    expect(mockMaybeActivateTrainerDashboard).toHaveBeenCalledWith("trainer_99");
  });

  it("ignores unmapped payloads with ok response", async () => {
    const body = JSON.stringify({ type: "ping", data: { object: { status: "pending" } } });
    const res = await POST(signedWebhookRequest(body, secret));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, ignored: true });
    expect(mockRecordCheckrBackgroundCheckPaid).not.toHaveBeenCalled();
  });
});
