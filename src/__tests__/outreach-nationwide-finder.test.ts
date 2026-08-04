import { describe, expect, it } from "vitest";

import {
  LEADS_PER_LANE,
  MAX_SEARCHES_PER_LANE,
  draftEmail,
  draftInstagramDm,
  hostnameOf,
  companyNameFrom,
  instagramHandleFrom,
  instagramHandleFromResult,
  looksLikeArticle,
  looksLikeOnlineCoach,
  pickQueries,
  rotationOffset,
} from "@/lib/outreach-nationwide-finder";
import { isEstWeekend } from "@/lib/outreach-lanes";

// Cities / geo terms that must never appear in outreach copy — Match Fit recruits online coaches
// nationwide, and geo-scoped copy is the exact bug this finder was rewritten to remove.
const GEO_TERMS = [
  "atlanta",
  "atl",
  "midtown",
  "old fourth ward",
  "o4w",
  "inman park",
  "georgia",
  "polygon",
  "neighborhood",
];

describe("targets", () => {
  it("aims for 5 leads per lane and stays inside the free SerpApi budget", () => {
    expect(LEADS_PER_LANE).toBe(5);
    // 2 searches per lane x 2 lanes x ~22 weekdays = 88 searches/month, under the free 100.
    expect(MAX_SEARCHES_PER_LANE * 2 * 22).toBeLessThanOrEqual(100);
  });
});

describe("instagramHandleFrom", () => {
  it("extracts a profile handle", () => {
    expect(instagramHandleFrom("https://www.instagram.com/coach.jane/")).toBe("coach.jane");
    expect(instagramHandleFrom("https://instagram.com/OnlineCoachMax")).toBe("onlinecoachmax");
  });

  it("rejects posts, reels and reserved sections", () => {
    expect(instagramHandleFrom("https://www.instagram.com/p/Cabc123/")).toBeNull();
    expect(instagramHandleFrom("https://www.instagram.com/reel/Cabc123/")).toBeNull();
    expect(instagramHandleFrom("https://www.instagram.com/explore/tags/onlinecoach/")).toBeNull();
    expect(instagramHandleFrom("https://www.instagram.com/coach.jane/tagged/")).toBeNull();
  });

  it("rejects non-Instagram URLs and junk", () => {
    expect(instagramHandleFrom("https://facebook.com/coach.jane")).toBeNull();
    expect(instagramHandleFrom("not a url")).toBeNull();
    expect(instagramHandleFrom("https://www.instagram.com/")).toBeNull();
  });
});

describe("looksLikeOnlineCoach", () => {
  it("accepts online / remote / virtual coaching language", () => {
    expect(looksLikeOnlineCoach("Online coach | fat loss")).toBe(true);
    expect(looksLikeOnlineCoach("Remote coaching for busy parents")).toBe(true);
    expect(looksLikeOnlineCoach("#onlinepersonaltrainer")).toBe(true);
    expect(looksLikeOnlineCoach("Virtual training, apply below")).toBe(true);
  });

  it("accepts a link-in-bio host paired with coaching language", () => {
    expect(looksLikeOnlineCoach("Jane — strength coach linktr.ee/jane")).toBe(true);
  });

  it("rejects a link-in-bio host with nothing fitness about it", () => {
    expect(looksLikeOnlineCoach("Photographer linktr.ee/pics")).toBe(false);
  });

  it("rejects unrelated accounts", () => {
    expect(looksLikeOnlineCoach("Local bakery, fresh bread daily")).toBe(false);
  });
});

describe("hostnameOf", () => {
  it("strips www and lowercases", () => {
    expect(hostnameOf("https://WWW.Example.COM/contact")).toBe("example.com");
  });

  it("returns null on junk", () => {
    expect(hostnameOf("nope")).toBeNull();
  });
});

describe("query rotation", () => {
  it("returns the requested number of queries", () => {
    const pool = ["a", "b", "c", "d", "e"];
    expect(pickQueries(pool, 2, new Date("2026-07-27T12:00:00Z"))).toHaveLength(2);
  });

  it("moves on to different queries on a different day", () => {
    const pool = ["a", "b", "c", "d", "e", "f"];
    const monday = pickQueries(pool, 2, new Date("2026-07-27T12:00:00Z"));
    const tuesday = pickQueries(pool, 2, new Date("2026-07-28T12:00:00Z"));
    expect(monday).not.toEqual(tuesday);
  });

  it("never returns more queries than the pool holds", () => {
    expect(pickQueries(["only"], 3, new Date("2026-07-27T12:00:00Z"))).toEqual(["only"]);
  });

  it("advances the rotation offset one step per day", () => {
    const a = rotationOffset(new Date("2026-07-27T00:30:00Z"));
    const b = rotationOffset(new Date("2026-07-28T00:30:00Z"));
    expect(b - a).toBe(1);
  });
});

describe("draft copy", () => {
  it("Instagram DM is DM-length and mentions both hooks", () => {
    const dm = draftInstagramDm("coach.jane");
    expect(dm).toContain("@coach.jane");
    expect(dm.length).toBeGreaterThanOrEqual(40); // DB requires a real body, not a stub
    expect(dm.length).toBeLessThanOrEqual(400); // a DM, not an email
    expect(dm.toLowerCase()).toContain("free to list");
    expect(dm.toLowerCase()).toContain("bring yourself");
    expect(dm.toLowerCase()).toContain("anywhere in the us");
  });

  it("email keeps a subject line and both hooks", () => {
    const { subject, body } = draftEmail("Jane Coaching");
    expect(subject.trim().length).toBeGreaterThan(0);
    expect(body).toContain("Jane Coaching");
    expect(body.toLowerCase()).toContain("free to list");
    expect(body.toLowerCase()).toContain("zero fee on any client you bring yourself");
    expect(body.length).toBeGreaterThanOrEqual(40);
  });

  it("email copes with a missing company name", () => {
    expect(draftEmail("").body.startsWith("Hi —")).toBe(true);
  });

  it("mentions no city or geography in either lane", () => {
    const all = `${draftInstagramDm("coach.jane")} ${draftEmail("Jane Coaching").subject} ${draftEmail("Jane Coaching").body}`.toLowerCase();
    for (const term of GEO_TERMS) {
      expect(all).not.toContain(term);
    }
  });

  it("invents no people and no testimonials", () => {
    const all = `${draftInstagramDm("coach.jane")} ${draftEmail("Jane Coaching").body}`.toLowerCase();
    // The only named party is Match Fit itself and the coach we are writing to.
    expect(all).not.toContain('"');
    expect(all).not.toMatch(/said|told me|one of my clients,|testimonial/);
  });
});

describe("isEstWeekend", () => {
  it("is true on Saturday and Sunday in New York", () => {
    expect(isEstWeekend(new Date("2026-07-25T16:00:00Z"))).toBe(true);
    expect(isEstWeekend(new Date("2026-07-26T16:00:00Z"))).toBe(true);
  });

  it("is false Monday to Friday", () => {
    expect(isEstWeekend(new Date("2026-07-27T16:00:00Z"))).toBe(false);
    expect(isEstWeekend(new Date("2026-07-31T16:00:00Z"))).toBe(false);
  });

  it("uses New York time, not UTC (Saturday 01:00 UTC is still Friday in ET)", () => {
    expect(isEstWeekend(new Date("2026-07-25T01:00:00Z"))).toBe(false);
  });
});

// --- OUT-VERIFY-NATIONWIDE-RUN 2026-08-04 -----------------------------------------------------
// Every case below is a row or a payload that actually happened, not a made-up example.

describe("looksLikeArticle — the junk that reached JB's queue on 2026-07-29", () => {
  it("rejects the real listicle and how-to titles that were written as leads", () => {
    for (const title of [
      "Best Online Personal Trainers (2026): Expert Tested",
      "The 6 Best Online Nutrition Coaches in 2025",
      "How to Become an Online Personal Trainer in 2026",
      "How to Start an Online Fitness Coaching Business in 2025",
      "Average Cost of Online Personal Trainer Per Month: 2026 ...",
    ]) {
      expect(looksLikeArticle(title)).toBe(true);
    }
  });

  it("rejects publisher paths even when the headline reads plain", () => {
    expect(looksLikeArticle("Online Nutrition Coaching", "https://www.onpoint-nutrition.com/blog/online-nutrition-coaches")).toBe(true);
    expect(looksLikeArticle("Coaching", "https://example.com/articles/coaching")).toBe(true);
  });

  it("keeps a real coach's own page", () => {
    expect(looksLikeArticle("Coach Claire Fitness")).toBe(false);
    expect(looksLikeArticle("Online Fitness Coaching & Personal Training", "https://themovementdr.net/remote-coaching/")).toBe(false);
    expect(looksLikeArticle("Kate Lyman Nutrition")).toBe(false);
  });
});

describe("companyNameFrom", () => {
  it("falls back to the domain when the title is a headline", () => {
    expect(companyNameFrom("Average Cost of Online Personal Trainer Per Month: 2026 ...", "warriorbabe.com")).toBe("Warriorbabe");
    expect(companyNameFrom("Find an Online Fitness Coach", "coachclairefitness.com")).toBe("Coachclairefitness");
  });

  it("keeps a real business name", () => {
    expect(companyNameFrom("Kate Lyman Nutrition | Home", "katelymannutrition.com")).toBe("Kate Lyman Nutrition");
  });

  it("never returns an empty name", () => {
    expect(companyNameFrom(undefined, "joshstrength.com")).toBe("Joshstrength");
  });
});

describe("instagramHandleFromResult — Google returns posts, never profiles", () => {
  // Verbatim organic results from SerpApi for
  // site:instagram.com "online fitness coach" "stan.store" on 2026-08-04.
  it("recovers the account behind a post or reel URL", () => {
    expect(
      instagramHandleFromResult({
        link: "https://www.instagram.com/p/DPj2JVNktdl/",
        source: "Instagram \u00b7 thepatcallahan",
      }),
    ).toBe("thepatcallahan");
    expect(
      instagramHandleFromResult({
        link: "https://www.instagram.com/reel/DbVJ3KKSx4P/",
        source: "Instagram \u00b7 zacperna",
      }),
    ).toBe("zacperna");
  });

  it("still prefers a real profile URL when there is one", () => {
    expect(
      instagramHandleFromResult({ link: "https://www.instagram.com/coach.jane/", source: "Instagram \u00b7 someoneelse" }),
    ).toBe("coach.jane");
  });

  it("returns null when there is no account to be had", () => {
    expect(instagramHandleFromResult({ link: "https://www.instagram.com/p/DPj2JVNktdl/", source: "Instagram" })).toBeNull();
    expect(instagramHandleFromResult({ link: "https://www.instagram.com/explore/tags/onlinecoach/" })).toBeNull();
    expect(instagramHandleFromResult({ link: "https://example.com/x" })).toBeNull();
  });
});
