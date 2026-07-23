import { describe, expect, it } from "vitest";
import {
  CONTENT_CALENDAR_REPURPOSE_CHAR_LIMIT,
  canonicalizeSocialSignupUrls,
  enforceGeneratedPostContent,
  fitCaptionForRepurpose,
  hasBrokenSocialSignupUrl,
  hasForbiddenSocialAudienceLabel,
  isSlideInventoryCarouselCaption,
  normalizeCoachLanguage,
  normalizeUserEditedPostContent,
  repurposePostLength,
} from "@/lib/content-calendar/content-rules";

describe("content-calendar content rules", () => {
  it("truncates AI-generated captions to fit the repurpose limit", () => {
    const longCaption = "A".repeat(600);
    const enforced = enforceGeneratedPostContent({
      caption: longCaption,
      hashtags: ["MatchFit"],
    });

    expect(enforced.withinLimit).toBe(true);
    expect(enforced.caption.length).toBeLessThan(longCaption.length);
    expect(enforced.caption.endsWith("…")).toBe(true);
  });

  it("preserves full caption text for operator edits while flagging over-limit posts", () => {
    const longCaption = "B".repeat(600);
    const normalized = normalizeUserEditedPostContent({
      caption: longCaption,
      hashtags: ["MatchFit", "Beta"],
    });

    expect(normalized.caption).toBe(longCaption);
    expect(normalized.withinLimit).toBe(false);
    expect(repurposePostLength(normalized.caption, normalized.hashtags)).toBeGreaterThan(
      CONTENT_CALENDAR_REPURPOSE_CHAR_LIMIT,
    );
  });

  it("fits caption around hashtag suffix length", () => {
    const hashtags = ["One", "Two", "Three"];
    const fitted = fitCaptionForRepurpose("X".repeat(520), hashtags);
    const suffix = `\n\n#One #Two #Three`;
    expect(fitted.length + suffix.length).toBeLessThanOrEqual(CONTENT_CALENDAR_REPURPOSE_CHAR_LIMIT + 1);
  });

  it("rewrites audience language to Fitness Pros and canonicalizes the Fitness Pro signup URL", () => {
    const caption =
      "Verified coaches should join Match Fit at match-fit.net/trainer/signup and start onboarding.";
    const enforced = enforceGeneratedPostContent({
      caption,
      hashtags: ["MatchFit"],
    });

    expect(enforced.caption).toContain("match-fit.net/trainer/sign-up");
    expect(enforced.caption).not.toContain("match-fit.net/trainer/signup");
    expect(enforced.caption).not.toContain("match-fit.net/Fitness Pro/signup");
    expect(enforced.caption).toContain("Fitness Pros");
    expect(enforced.caption).not.toMatch(/\bCoach(?:es)?\b/i);
  });

  it("repairs broken Fitness Pro signup URLs back to /trainer/sign-up", () => {
    const normalized = normalizeUserEditedPostContent({
      caption: "Join as a Fitness Pro at match-fit.net/Fitness Pro/signup today.",
      hashtags: [],
    });

    expect(normalized.caption).toBe("Join as a Fitness Pro at match-fit.net/trainer/sign-up today.");
  });

  it("does not rewrite deeper /trainer/signup flow paths", () => {
    const out = normalizeCoachLanguage("Finish terms at match-fit.net/trainer/signup/terms then pay.");
    expect(out).toContain("match-fit.net/trainer/signup/terms");
    expect(out).not.toContain("match-fit.net/trainer/sign-up/terms");
  });

  it("flags forbidden labels, broken URLs, and slide-inventory carousel captions", () => {
    expect(hasForbiddenSocialAudienceLabel("Join as a Coach today")).toBe(true);
    expect(hasForbiddenSocialAudienceLabel("Join as a Fitness Pro today")).toBe(false);
    expect(hasBrokenSocialSignupUrl("Start at match-fit.net/trainer/signup")).toBe(true);
    expect(hasBrokenSocialSignupUrl("Start at match-fit.net/trainer/sign-up")).toBe(false);
    expect(
      isSlideInventoryCarouselCaption(
        "Slide 1: Trust. Slide 2: Tools. Slide 3: Sign up at match-fit.net/trainer/sign-up.",
      ),
    ).toBe(true);
    expect(
      isSlideInventoryCarouselCaption(
        "First 30 Fitness Pros get 60 days Premium free. Claim your spot at match-fit.net/trainer/sign-up.",
      ),
    ).toBe(false);
    expect(canonicalizeSocialSignupUrls("go match-fit.net/trainer/signup now")).toContain(
      "match-fit.net/trainer/sign-up",
    );
  });
});
