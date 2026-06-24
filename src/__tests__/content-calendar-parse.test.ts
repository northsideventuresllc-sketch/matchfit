import { describe, expect, it } from "vitest";
import {
  parseGeneratedPostArrayPayload,
  parseGeneratedPostPayload,
} from "@/lib/content-calendar/content-calendar-parse";

describe("content-calendar-parse", () => {
  it("parses clean JSON objects", () => {
    const parsed = parseGeneratedPostPayload(
      JSON.stringify({
        caption: "First 10 Match Fit Pros get fully covered background checks.",
        visualPrompt: "Bold static graphic with a Fitness Pro signing up on phone.",
        hashtags: ["MatchFit", "FitnessPro"],
      }),
    );

    expect(parsed?.caption).toMatch(/background checks/i);
    expect(parsed?.hashtags).toEqual(["MatchFit", "FitnessPro"]);
  });

  it("parses markdown-wrapped JSON", () => {
    const parsed = parseGeneratedPostPayload(`\`\`\`json
{"caption":"Swipe to find your Fitness Pro match.","visualPrompt":null,"hashtags":["MatchFit"]}
\`\`\``);

    expect(parsed?.caption).toMatch(/Swipe to find/i);
    expect(parsed?.visualPrompt).toBeNull();
  });

  it("repairs JSON with literal newlines inside caption strings", () => {
    const parsed = parseGeneratedPostPayload(`{
      "caption": "Line one
Line two with a concrete Match Fit promo.",
      "visualPrompt": "Carousel frame 1: athlete swiping on phone.",
      "hashtags": ["MatchFit"]
    }`);

    expect(parsed?.caption).toMatch(/Line one/);
    expect(parsed?.caption).toMatch(/Line two/);
  });

  it("parses posts arrays and single-post wrappers", () => {
    const batch = parseGeneratedPostArrayPayload(`{
      "posts": [
        {"caption":"Join the founding Fitness Pro cohort today.","visualPrompt":"Static hero image.","hashtags":["MatchFit"]},
        {"caption":"Clients get 60-day VIP access during beta.","visualPrompt":null,"hashtags":["FitHub"]}
      ]
    }`);

    expect(batch).toHaveLength(2);
    expect(batch?.[0]?.caption).toMatch(/founding Fitness Pro/i);
    expect(batch?.[1]?.caption).toMatch(/VIP access/i);
  });

  it("falls back to prose when the model returns plain caption text", () => {
    const parsed = parseGeneratedPostPayload(
      "Stop renting attention on feeds that do not convert. Match Fit gives verified Fitness Pros discovery, chat, and founding onboarding support. Start at match-fit.net/trainer/signup.",
    );

    expect(parsed?.caption).toMatch(/Stop renting attention/i);
  });
});
