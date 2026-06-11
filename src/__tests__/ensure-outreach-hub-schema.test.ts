import { Prisma } from "@/generated/prisma/client";
import { describe, expect, it } from "vitest";
import { isMissingOutreachHubSchemaError } from "@/lib/ensure-outreach-hub-schema";

describe("isMissingOutreachHubSchemaError", () => {
  it("detects missing savedToHubAt column messages", () => {
    const err = new Error(
      'Invalid `prisma.outreachInstagramLead.findMany()` invocation: The column `outreach_instagram_leads.savedToHubAt` does not exist in the current database.',
    );
    expect(isMissingOutreachHubSchemaError(err)).toBe(true);
  });

  it("detects missing outreach table messages", () => {
    const err = new Error('relation "outreach_instagram_leads" does not exist');
    expect(isMissingOutreachHubSchemaError(err)).toBe(true);
  });

  it("detects Prisma P2022", () => {
    const err = new Prisma.PrismaClientKnownRequestError("Column does not exist", {
      code: "P2022",
      clientVersion: "test",
      meta: { column: "outreach_instagram_leads.savedToHubAt" },
    });
    expect(isMissingOutreachHubSchemaError(err)).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isMissingOutreachHubSchemaError(new Error("connection refused"))).toBe(false);
  });
});
