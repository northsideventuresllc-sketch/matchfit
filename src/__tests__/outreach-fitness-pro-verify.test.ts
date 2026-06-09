import { describe, expect, it } from "vitest";
import {
  assessFitnessProfessionalLeadText,
  assessFitnessProfessionalProfile,
  scoreFitnessProfessionalText,
} from "@/lib/outreach-fitness-pro-verify";

const baseProfile = {
  ok: true as const,
  username: "jordan_lee_coaching",
  profileUrl: "https://www.instagram.com/jordan_lee_coaching/",
  fullName: "Jordan Lee",
  biography: "Atlanta personal trainer | 1:1 coaching | NASM CPT",
  isPrivate: false,
  categoryName: "Fitness Trainer",
  followerCount: 12_400,
  verifiedVia: "api" as const,
};

describe("scoreFitnessProfessionalText", () => {
  it("scores strong coaching bios highly", () => {
    const scored = scoreFitnessProfessionalText({
      biography: "NASM CPT | Online strength coach | Apply for coaching",
      username: "coach_jordan",
    });
    expect(scored.score).toBeGreaterThanOrEqual(50);
    expect(scored.tier).toBe("verified");
  });

  it("gives partial credit for fitness usernames and soft fitness language", () => {
    const scored = scoreFitnessProfessionalText({
      username: "fitnessbyjess",
      biography: "Helping women get stronger every day",
    });
    expect(scored.score).toBeGreaterThanOrEqual(16);
  });

  it("penalizes fashion designers without fitness signals", () => {
    const scored = scoreFitnessProfessionalText({
      fullName: "Kay Styles",
      biography: "Fashion designer | boutique owner | DM for collabs",
      username: "stylebykay",
    });
    expect(scored.score).toBeLessThan(0);
  });
});

describe("assessFitnessProfessionalProfile", () => {
  it("accepts a public personal trainer profile", () => {
    const result = assessFitnessProfessionalProfile(baseProfile);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tier).toMatch(/verified|likely/);
      expect(result.fitnessScore).toBeGreaterThanOrEqual(22);
    }
  });

  it("accepts fitness usernames when bio is sparse but profile is public", () => {
    const result = assessFitnessProfessionalProfile({
      ...baseProfile,
      verifiedVia: "html",
      biography: null,
      categoryName: null,
      username: "fitnessbyjess",
      fullName: "Jess",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects private accounts", () => {
    expect(
      assessFitnessProfessionalProfile({
        ...baseProfile,
        isPrivate: true,
      }),
    ).toEqual({
      ok: false,
      reason: "Private Instagram account — need a public coaching profile.",
    });
  });

  it("rejects fashion designers and lifestyle creators", () => {
    expect(
      assessFitnessProfessionalProfile({
        ...baseProfile,
        username: "stylebykay",
        fullName: "Kay Styles",
        biography: "Fashion designer | boutique owner | DM for collabs",
        categoryName: "Designer",
      }),
    ).toEqual({
      ok: false,
      reason: "Profile looks like fashion, beauty, or lifestyle — not a fitness pro.",
    });
  });

  it("rejects mega-influencers on the blocklist", () => {
    expect(
      assessFitnessProfessionalProfile({
        ...baseProfile,
        username: "blogilates",
        biography: "Online fitness coach",
      }),
    ).toEqual({
      ok: false,
      reason: "Account is a mega-brand/creator, not an independent coach prospect.",
    });
  });

  it("rejects profiles without coaching signals in bio or category", () => {
    expect(
      assessFitnessProfessionalProfile({
        ...baseProfile,
        username: "kayla_travels",
        biography: "Coffee, travel, and good vibes only",
        categoryName: "Digital creator",
      }),
    ).toEqual({
      ok: false,
      reason: "Profile doesn't look like a fitness pro — no clear training, coaching, or nutrition signals.",
    });
  });
});

describe("assessFitnessProfessionalLeadText", () => {
  it("accepts facebook page leads about trainer communities", () => {
    const result = assessFitnessProfessionalLeadText({
      pageName: "Atlanta Personal Trainers Network",
      niche: "personal training",
      whyMatchFit: "Active group of Atlanta fitness coaches sharing clients and gym openings.",
    });
    expect(result.ok).toBe(true);
  });

  it("accepts trainer email leads with business context", () => {
    const result = assessFitnessProfessionalLeadText({
      name: "Chris Morgan",
      businessName: "Morgan Performance Coaching",
      niche: "strength coaching",
      whyMatchFit: "Independent online strength coach with a public contact page.",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects non-fitness email leads", () => {
    expect(
      assessFitnessProfessionalLeadText({
        name: "Kay Styles",
        businessName: "Kay Styles Boutique",
        whyMatchFit: "Fashion designer with a public contact form.",
      }),
    ).toEqual({
      ok: false,
      reason: "Lead doesn't look like a fitness pro — no clear training, coaching, or nutrition focus.",
    });
  });
});
