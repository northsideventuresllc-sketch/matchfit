import { describe, expect, it } from "vitest";
import {
  hasBlockingContentCopyIssue,
  scanContentCopy,
  softFixContentCopy,
} from "@/lib/content-calendar/content-copy-guard";

describe("content copy guard", () => {
  it("soft-fixes geo phrasing to worldwide-safe wording", () => {
    expect(softFixContentCopy("Coaches nationwide are joining.")).toBe(
      "Coaches worldwide are joining.",
    );
    expect(softFixContentCopy("Trainers across the country love it.")).toBe(
      "Trainers around the world love it.",
    );
  });

  it("preserves casing when rewriting", () => {
    expect(softFixContentCopy("NATIONWIDE launch")).toBe("WORLDWIDE launch");
    expect(softFixContentCopy("Nationwide launch")).toBe("Worldwide launch");
  });

  it("flags geo as blocking and leading Fitness Pro as a warning", () => {
    const geo = scanContentCopy("Nationwide coaching, join now.");
    expect(geo.some((i) => i.kind === "geo" && i.severity === "block")).toBe(true);

    const term = scanContentCopy("Fitness Pros: this is your moment.");
    expect(term.some((i) => i.kind === "internal_term" && i.severity === "warn")).toBe(true);
  });

  it("reports no blocking issue once geo phrasing is soft-fixed", () => {
    expect(hasBlockingContentCopyIssue("Coaches nationwide are joining.")).toBe(false);
    expect(hasBlockingContentCopyIssue("Coaches worldwide are joining.")).toBe(false);
  });

  it("leaves clean worldwide copy untouched", () => {
    const clean = "Match Fit matches clients with trainers worldwide.";
    expect(softFixContentCopy(clean)).toBe(clean);
    expect(scanContentCopy(clean)).toHaveLength(0);
  });
});
