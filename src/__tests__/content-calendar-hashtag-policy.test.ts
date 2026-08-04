import { describe, expect, it } from "vitest";

import {
  enforceHighVolumeHashtags,
  HIGH_VOLUME_HASHTAGS,
  HIGH_VOLUME_HASHTAG_RULE,
  isHighVolumeHashtag,
} from "@/lib/content-calendar/hashtag-policy";
import { enforceGeneratedPostContent, normalizeUserEditedPostContent } from "@/lib/content-calendar/content-rules";

describe("JB locked high-volume hashtag rule", () => {
  it("drops invented and long-tail tags", () => {
    const out = enforceHighVolumeHashtags([
      "FitnessMarketplaceForPros",
      "TrainTheWorld",
      "FoundingMember",
      "gym",
    ]);
    expect(out).toContain("gym");
    expect(out).not.toContain("FitnessMarketplaceForPros");
    expect(out).not.toContain("TrainTheWorld");
    expect(out).not.toContain("FoundingMember");
  });

  it("drops the branded tag nobody searches", () => {
    expect(isHighVolumeHashtag("MatchFit")).toBe(false);
    expect(enforceHighVolumeHashtags(["MatchFit", "#MatchFit"])).not.toContain("matchfit");
  });

  it("backfills to a full set from the audience pool", () => {
    const clients = enforceHighVolumeHashtags(["madeUpTag"], { group: "Clients", max: 5 });
    expect(clients).toHaveLength(5);
    expect(clients.every(isHighVolumeHashtag)).toBe(true);

    const pros = enforceHighVolumeHashtags([], { group: "Join the Team", max: 5 });
    expect(pros).toHaveLength(5);
    expect(pros).toContain("personaltrainer");
  });

  it("accepts approved tags with or without a # prefix and dedupes", () => {
    expect(enforceHighVolumeHashtags(["#gym", "gym", "GYM"], { max: 5 })[0]).toBe("gym");
  });

  it("states the rule in the prompt text", () => {
    expect(HIGH_VOLUME_HASHTAG_RULE).toMatch(/high-follower, already-popular/i);
    expect(HIGH_VOLUME_HASHTAG_RULE).toMatch(/Never invent a hashtag/i);
    expect(HIGH_VOLUME_HASHTAG_RULE).toMatch(/#MatchFit/);
  });

  it("keeps every pooled tag self-consistent", () => {
    for (const tag of HIGH_VOLUME_HASHTAGS) {
      expect(tag).toBe(tag.toLowerCase());
      expect(tag.startsWith("#")).toBe(false);
      expect(isHighVolumeHashtag(tag)).toBe(true);
    }
  });
});

describe("generation vs operator edits", () => {
  it("coerces generated post hashtags to the approved pool", () => {
    const out = enforceGeneratedPostContent({
      caption: "Hook line then payoff.",
      hashtags: ["MatchFit", "FitnessMarketplace", "gym"],
      targetGroup: "Clients",
    });
    expect(out.hashtags).toContain("gym");
    expect(out.hashtags).not.toContain("MatchFit");
    expect(out.hashtags.every(isHighVolumeHashtag)).toBe(true);
  });

  it("does NOT coerce hashtags a human typed by hand", () => {
    const out = normalizeUserEditedPostContent({
      caption: "Operator wrote this.",
      hashtags: ["MatchFit", "SomeCampaignTag"],
    });
    expect(out.hashtags).toEqual(["MatchFit", "SomeCampaignTag"]);
  });
});
