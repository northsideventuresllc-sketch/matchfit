import { describe, expect, it } from "vitest";
import { canonicalAdministratorCode, deriveAdministratorCode } from "@/lib/admin-code";

describe("administrator code", () => {
  it("derives letters and MMDD from ISO birth date", () => {
    expect(deriveAdministratorCode("Alice", "Sample", "2001-01-01")).toBe("ALSA0101");
    expect(canonicalAdministratorCode("Alice", "Sample", "2001-01-01")).toBe("alsa0101");
  });

  it("strips non-letters from names", () => {
    expect(deriveAdministratorCode("Al-ice", "Sa!", "2000-12-31")).toBe("ALSA1231");
  });
});
