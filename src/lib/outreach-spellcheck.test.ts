import { describe, expect, it } from "vitest";

import { spellcheckOutreachCopy } from "@/lib/outreach-spellcheck";

// Fix #3 (WF2.02) — spellcheck pass run immediately after DM/email copy is generated, before it
// is ever shown to JB for approval. Approved copy is never auto-edited after the fact; this only
// covers the pre-approval generation step.

describe("spellcheckOutreachCopy", () => {
  it("fixes an obvious typo in a scraped company name", async () => {
    const result = await spellcheckOutreachCopy("Hi Strenght Coaching — found your site.");
    expect(result.text).toContain("Strength");
    expect(result.corrections.length).toBeGreaterThan(0);
  });

  it("leaves clean copy untouched", async () => {
    const clean = "Hey @coach.jane — saw you coach clients online. Free to list, match-fit.net";
    const result = await spellcheckOutreachCopy(clean);
    expect(result.text).toBe(clean);
    expect(result.corrections).toEqual([]);
  });

  it("never rewrites an @handle or the brand domain", async () => {
    const text = "Hey @coachjannn — check out match-fit.net for more.";
    const result = await spellcheckOutreachCopy(text);
    expect(result.text).toContain("@coachjannn");
    expect(result.text).toContain("match-fit.net");
  });

  it("handles empty input", async () => {
    expect(await spellcheckOutreachCopy("")).toEqual({ text: "", corrections: [] });
  });
});
