import { describe, expect, it } from "vitest";
import { canonicalAdministratorCode, deriveAdministratorCode } from "@/lib/admin-code";

describe("administrator code", () => {
  it("derives letters and MMDD from ISO birth date", () => {
    expect(deriveAdministratorCode("Jonny", "Booth", "1990-06-02")).toBe("JOBO0602");
    expect(canonicalAdministratorCode("Jonny", "Booth", "1990-06-02")).toBe("jobo0602");
  });

  it("strips non-letters from names", () => {
    expect(deriveAdministratorCode("Jo-ny", "Bo!", "2000-12-31")).toBe("JOBO1231");
  });
});
