import { describe, expect, it } from "vitest";
import {
  OUTREACH_HQ_SUMMARY,
  adminAiNotConfiguredMessage,
  outreachAiProviderHint,
} from "@/lib/admin-ai-copy";

describe("admin-ai-copy", () => {
  it("mentions platform_secrets in not-configured help", () => {
    expect(adminAiNotConfiguredMessage()).toContain("platform_secrets");
  });

  it("warns OpenAI cannot web-search for outreach", () => {
    expect(outreachAiProviderHint("openai")).toMatch(/web-search/i);
  });

  it("keeps outreach summary distinct from registered trainers", () => {
    expect(OUTREACH_HQ_SUMMARY).toMatch(/external fitness pros/i);
    expect(OUTREACH_HQ_SUMMARY).toMatch(/Match Fit trainers/i);
  });
});
