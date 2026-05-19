import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { parseCheckrWebhookPaidCents, verifyCheckrWebhookSignature } from "@/lib/checkr";

describe("verifyCheckrWebhookSignature", () => {
  it("accepts a valid HMAC-SHA256 hex signature", () => {
    const secret = "test-secret";
    const payload = JSON.stringify({ monday: "75F", tuesday: "80F" });
    const signature = createHmac("sha256", secret).update(payload).digest("hex");
    expect(verifyCheckrWebhookSignature(payload, signature, secret)).toBe(true);
  });

  it("rejects tampered payloads", () => {
    const secret = "test-secret";
    const payload = JSON.stringify({ monday: "75F" });
    const signature = createHmac("sha256", secret).update(payload).digest("hex");
    expect(verifyCheckrWebhookSignature(payload + " ", signature, secret)).toBe(false);
  });
});

describe("parseCheckrWebhookPaidCents", () => {
  it("parses completed report with trainer metadata and price in cents", () => {
    const parsed = parseCheckrWebhookPaidCents({
      type: "report.completed",
      data: {
        object: {
          id: "rep_1",
          candidate_id: "cand_1",
          status: "complete",
          price: 4900,
          metadata: { trainerId: "trainer-abc" },
        },
      },
    });
    expect(parsed).toEqual({
      reportId: "rep_1",
      candidateId: "cand_1",
      vendorPaidCents: 4900,
      externalTrainerId: "trainer-abc",
    });
  });

  it("parses mf_trainer package prefix", () => {
    const parsed = parseCheckrWebhookPaidCents({
      data: {
        object: {
          id: "rep_2",
          status: "clear",
          amount: 49,
          package: "mf_trainer:trainer-xyz",
        },
      },
    });
    expect(parsed?.externalTrainerId).toBe("trainer-xyz");
    expect(parsed?.vendorPaidCents).toBe(4900);
  });
});
