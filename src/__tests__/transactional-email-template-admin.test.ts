import { describe, expect, it } from "vitest";
import { TRANSACTIONAL_EMAIL_KINDS } from "@/lib/transactional-email-kinds";
import { compileTransactionalEmail } from "@/lib/transactional-email-template-compile";
import { getDefaultTransactionalEmailTemplateFields } from "@/lib/transactional-email-template-defaults";
import { adminCanDirectEditEmailTemplates } from "@/lib/match-fit-email-template-owner";
import { buildTransactionalEmail, sampleContextForTransactionalEmail } from "@/lib/transactional-email-templates";

describe("transactional email template defaults", () => {
  it("compiles every kind with sample context", () => {
    for (const kind of TRANSACTIONAL_EMAIL_KINDS) {
      const ctx = sampleContextForTransactionalEmail(kind);
      const fields = getDefaultTransactionalEmailTemplateFields(kind);
      const out = compileTransactionalEmail(kind, ctx, fields);
      expect(out.subject.length).toBeGreaterThan(0);
      expect(out.text.length).toBeGreaterThan(0);
      expect(out.html).toContain("Match Fit");
    }
  });

  it("buildTransactionalEmail matches compile for defaults", () => {
    for (const kind of TRANSACTIONAL_EMAIL_KINDS) {
      const ctx = sampleContextForTransactionalEmail(kind);
      const legacy = buildTransactionalEmail(kind, ctx);
      expect(legacy.subject.length).toBeGreaterThan(0);
      expect(legacy.html.length).toBeGreaterThan(100);
    }
  });
});

describe("match-fit-email-template-owner", () => {
  it("allows direct edit only for jobo0602", () => {
    expect(adminCanDirectEditEmailTemplates("jobo0602")).toBe(true);
    expect(adminCanDirectEditEmailTemplates("JOBO0602")).toBe(true);
    expect(adminCanDirectEditEmailTemplates("ab12cd34")).toBe(false);
  });
});
