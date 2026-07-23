import { describe, expect, it } from "vitest";

import { emailSubject, genericInviteTail, instagramPersonalizedOpener } from "@/lib/outreach-templates";

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

  it("keeps legacy ATL_LOCAL phrasing for non-sentence hook fragments", () => {
    const opener = instagramPersonalizedOpener("ATL_LOCAL", "Coach Mo", "the way you coach movement prep");

    expect(opener).toContain("Came across your page");
    expect(opener).toContain("the way you coach movement prep.");
  });

  it("keeps legacy VIRTUAL phrasing for non-sentence hook fragments", () => {
    const opener = instagramPersonalizedOpener("VIRTUAL", "Coach Nia", "your remote client check-in structure");

    expect(opener).toContain("Your online coaching content stands out");
    expect(opener).toContain("your remote client check-in structure.");
  });

  it("returns expected generic tails and subject lines by platform/group", () => {
    expect(genericInviteTail("instagram", "ATL_LOCAL")).toContain("launching Match Fit in Atlanta");
    expect(genericInviteTail("instagram", "ATL_LOCAL")).toContain("match-fit.net/trainer/sign-up");
    expect(genericInviteTail("email", "VIRTUAL")).toContain("Virtual clients discover you through Match Fit");
    expect(genericInviteTail("email", "VIRTUAL")).toContain("match-fit.net/trainer/sign-up");
    expect(emailSubject("ATL_LOCAL")).toBe("ATL Fitness Pros — founding spot on Match Fit");
    expect(emailSubject("VIRTUAL")).toBe("Virtual Fitness Pros — early roster on Match Fit");
  });
});
