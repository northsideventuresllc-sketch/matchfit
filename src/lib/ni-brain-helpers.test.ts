import { describe, expect, it } from "vitest";
import { sanitizeForNiBrain, truncateNiBrainText } from "@/lib/ni-brain-helpers";

describe("ni-brain-helpers", () => {
  it("truncates long text", () => {
    expect(truncateNiBrainText("hello world", 20)).toBe("hello world");
    expect(truncateNiBrainText("a".repeat(30), 10)).toBe(`${"a".repeat(9)}…`);
  });

  it("redacts jwt-like tokens and connection strings", () => {
    const raw =
      "key=eyJhbGciOiJIUzI1NiJ9.payload.sig postgresql://user:pass@host/db";
    expect(sanitizeForNiBrain(raw)).not.toContain("postgresql://");
    expect(sanitizeForNiBrain(raw)).toContain("[redacted]");
  });
});
