import { describe, expect, it, vi } from "vitest";
import { analyzeFpDocumentUpload } from "@/lib/fp-document-auto-analyzer";
import {
  fpTierSelectableDuringBeta,
  fpTierSignupCardsForDisplay,
  FP_BETA_PREMIUM_PRO_STICKER,
} from "@/lib/fp-tier-beta-signup";

vi.mock("@/lib/beta-launch-config", () => ({
  isBetaLaunchGatesEnabled: () => true,
}));

describe("analyzeFpDocumentUpload", () => {
  it("denies invalid extension for headshot", () => {
    const result = analyzeFpDocumentUpload({
      docType: "headshot",
      fileUrl: "/uploads/fp-docs/t1-headshot.pdf",
      fileSizeBytes: 50_000,
      mimeType: "application/pdf",
    });
    expect(result.decision).toBe("deny");
  });

  it("approves valid certification upload", () => {
    const result = analyzeFpDocumentUpload({
      docType: "professional_certification",
      fileUrl: "/uploads/fp-docs/t1-professional_certification.pdf",
      fileSizeBytes: 120_000,
      mimeType: "application/pdf",
    });
    expect(result.decision).toBe("approve");
  });
});

describe("fp beta signup display", () => {
  it("exposes beta sticker copy", () => {
    expect(FP_BETA_PREMIUM_PRO_STICKER).toContain("60 DAYS");
  });

  it("hides match fit pro during beta", () => {
    expect(fpTierSelectableDuringBeta("match_fit_pro")).toBe(false);
    expect(fpTierSelectableDuringBeta("match_fit_premium_pro")).toBe(true);
  });

  it("shows premium and paid tiers only", () => {
    const tiers = fpTierSignupCardsForDisplay().map((c) => c.tier);
    expect(tiers).toContain("match_fit_premium_pro");
    expect(tiers).toContain("independent_fitness_pro");
    expect(tiers).not.toContain("match_fit_pro");
  });
});
