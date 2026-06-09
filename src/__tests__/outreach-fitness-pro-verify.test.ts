import { describe, expect, it } from "vitest";
import { assessFitnessProfessionalProfile } from "@/lib/outreach-fitness-pro-verify";

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

describe("assessFitnessProfessionalProfile", () => {
  it("accepts a public personal trainer profile", () => {
    expect(assessFitnessProfessionalProfile(baseProfile)).toEqual({
      ok: true,
      niche: "Personal training & coaching",
    });
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

  it("rejects accounts with very large followings", () => {
    expect(
      assessFitnessProfessionalProfile({
        ...baseProfile,
        followerCount: 900_000,
      }),
    ).toEqual({
      ok: false,
      reason: "Account has too many followers — target independent coaches, not mega-influencers.",
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
      reason: "Bio does not show personal training, coaching, or nutrition services.",
    });
  });

  it("accepts nutrition coaches via category when bio is sparse", () => {
    expect(
      assessFitnessProfessionalProfile({
        ...baseProfile,
        biography: "Helping busy adults eat better",
        categoryName: "Nutritionist",
      }),
    ).toEqual({
      ok: true,
      niche: "Nutrition coaching",
    });
  });

  it("rejects HTML-verified profiles without a readable fitness bio", () => {
    expect(
      assessFitnessProfessionalProfile({
        ...baseProfile,
        verifiedVia: "html",
        biography: null,
        categoryName: "Digital creator",
      }),
    ).toEqual({
      ok: false,
      reason: "Could not confirm coaching services from this profile — need a public fitness bio.",
    });
  });
});
