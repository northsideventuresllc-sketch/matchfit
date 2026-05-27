import { describe, expect, it } from "vitest";
import { formatUsdFromCents } from "@/lib/admin-portal-data";

describe("formatUsdFromCents", () => {
  it("formats whole dollars", () => {
    expect(formatUsdFromCents(12_500)).toBe("$125");
  });

  it("formats zero", () => {
    expect(formatUsdFromCents(0)).toBe("$0");
  });
});
