import { describe, expect, it } from "vitest";

import {
  emailSubject,
  genericInviteTail,
  instagramPersonalizedOpener,
  OUTREACH_BRAND_FACTS,
} from "@/lib/outreach-templates";

describe("outreach-templates", () => {
  it("uses sentence hooks directly for ATL_LOCAL opener copy", () => {
    const opener = instagramPersonalizedOpener(
      "ATL_LOCAL",
      "Coach Jay",
      "Your client case-study post yesterday was seriously detailed.",
    );

    expect(opener).toBe(
      "Hey Coach Jay 👋\n\nYour client case-study post yesterday was seriously detailed.\n\n",
    );
  });

  it("uses sentence hooks directly for VIRTUAL opener copy", () => {
    const opener = instagramPersonalizedOpener(
      "VIRTUAL",
      "Coach Liv",
      "Your 4-week cut framework breakdown was great!",
    );

    expect(opener).toBe("Hey Coach Liv 👋\n\nYour 4-week cut framework breakdown was great!\n\n");
  });

  it("uses the same nationwide phrasing for the dead legacy group", () => {
    const opener = instagramPersonalizedOpener("ATL_LOCAL", "Coach Mo", "the way you coach movement prep");

    expect(opener).toContain("Your online coaching content stands out");
    expect(opener).toContain("the way you coach movement prep.");
  });

  it("keeps legacy VIRTUAL phrasing for non-sentence hook fragments", () => {
    const opener = instagramPersonalizedOpener("VIRTUAL", "Coach Nia", "your remote client check-in structure");

    expect(opener).toContain("Your online coaching content stands out");
    expect(opener).toContain("your remote client check-in structure.");
  });

  it("returns expected generic tails and subject lines by platform", () => {
    expect(genericInviteTail("instagram", "VIRTUAL")).toContain("We're building Match Fit");
    expect(genericInviteTail("instagram", "VIRTUAL")).toContain("match-fit.net/trainer/sign-up");
    expect(genericInviteTail("email", "VIRTUAL")).toContain("Virtual clients discover you through Match Fit");
    expect(genericInviteTail("email", "VIRTUAL")).toContain("match-fit.net/trainer/sign-up");
    expect(emailSubject("VIRTUAL")).toBe("Virtual Fitness Pros — early roster on Match Fit");
  });

  // Zero-Sales Signup Engine G1/G2 (JB locked 2026-07-22) — the AI-generation system
  // prompt must explicitly forbid call/calendar language and question-ending copy;
  // template *structure* alone was never enough to guarantee the AI honors this.
  it("instructs the AI to never write call/calendar language (G1)", () => {
    expect(OUTREACH_BRAND_FACTS.toLowerCase()).toMatch(/never write "call," "hop on," "chat," "book time,"/);
  });

  it("instructs the AI to end on the signup link, never on a question (G2)", () => {
    expect(OUTREACH_BRAND_FACTS).toMatch(/do not end the message with a question/i);
    expect(OUTREACH_BRAND_FACTS).toMatch(/claim your spot here/i);
  });

  // NI-Brain Decision #342 — recruiting is nationwide. The legacy ATL_LOCAL group still
  // exists on historic rows, so copy must stay geo-free no matter which group is passed.
  it("never emits geo-scoped copy, including for the dead legacy group", () => {
    for (const group of ["ATL_LOCAL", "VIRTUAL"] as const) {
      for (const platform of ["instagram", "facebook", "email"] as const) {
        expect(genericInviteTail(platform, group).toLowerCase()).not.toMatch(/atlanta|\batl\b|georgia/);
      }
      expect(emailSubject(group).toLowerCase()).not.toMatch(/atlanta|\batl\b|georgia/);
      expect(
        instagramPersonalizedOpener(group, "Jane", "your remote client check-in structure").toLowerCase(),
      ).not.toMatch(/atlanta|\batl\b|georgia/);
    }
  });
});
