import { describe, expect, it } from "vitest";
import {
  MATCH_FIT_SIGNATURE_FROM_EMAIL,
  MATCH_FIT_SIGNATURE_LINES,
  matchFitSignatureText,
} from "@/lib/match-fit-signature";

describe("matchFitSignature", () => {
  it("locks From address and NORTHSiDE casing", () => {
    expect(MATCH_FIT_SIGNATURE_FROM_EMAIL).toBe("jb@match-fit.net");
    expect(MATCH_FIT_SIGNATURE_LINES.join("\n")).toContain("NORTHSiDE Intelligence Ecosystem");
    expect(matchFitSignatureText().split("\n")).toHaveLength(MATCH_FIT_SIGNATURE_LINES.length);
  });
});
