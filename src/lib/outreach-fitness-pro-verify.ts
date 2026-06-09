import "server-only";

import type { InstagramProfileVerification } from "@/lib/instagram-profile-verify";

const FITNESS_SIGNAL =
  /\b(personal\s+train|online\s+coach|fitness\s+coach|strength\s+coach|nutrition(ist)?|dietitian|\brd\b|\bl\d\b|coach(ing)?|trainer|training|workout|gym|crossfit|pilates|yoga\s+instruct|sports?\s+performance|health\s+coach|wellness\s+coach|virtual\s+coach|1[:\-]1\s+coaching|macro\s+coach|prep\s+coach|nasm|ace|cscs|corrective\s+exercise|s&c|sports?\s+nutrition|fit\s+pro|fitness\s+pro|body\s+transform|fat\s+loss|muscle\s+gain|hypertrophy|powerlifting|bodybuilding|bootcamp|group\s+fitness|semi[\-\s]?private|in[\-\s]?person\s+train|remote\s+coach)\b/i;

const FITNESS_CATEGORY =
  /\b(fitness\s+trainer|personal\s+trainer|coach|athlete|gym|fitness|health|wellness|sports?\s+team|nutrition)\b/i;

const NON_FITNESS_SIGNAL =
  /\b(fashion\s+design|designer|boutique|jewelry|jewellery|makeup|mua|beauty\s+brand|model(ing)?|photographer|wedding|bridal|real\s+estate|realtor|crypto|nft|artist|art\s+studio|musician|rapper|dj\b|clothing\s+brand|apparel|streetwear|salon|hairstyl|nail\s+tech|lash(es)?|brow|skincare\s+brand|boutique\s+owner)\b/i;

const MEGA_INFLUENCER_BLOCKLIST = new Set([
  "blogilates",
  "kayla_itsines",
  "chloe_t",
  "whitneyysimmons",
  "athleanx",
  "sydneycummings",
  "mindpumpmedia",
  "theofficialmatchfit",
]);

const MAX_FOLLOWERS = 500_000;

export function assessFitnessProfessionalProfile(
  profile: Extract<InstagramProfileVerification, { ok: true }> & {
    categoryName?: string | null;
    followerCount?: number | null;
  },
): { ok: true; niche: string } | { ok: false; reason: string } {
  if (profile.isPrivate) {
    return { ok: false, reason: "Private Instagram account — need a public coaching profile." };
  }

  if (typeof profile.followerCount === "number" && profile.followerCount >= MAX_FOLLOWERS) {
    return {
      ok: false,
      reason: "Account has too many followers — target independent coaches, not mega-influencers.",
    };
  }

  if (MEGA_INFLUENCER_BLOCKLIST.has(profile.username.toLowerCase())) {
    return { ok: false, reason: "Account is a mega-brand/creator, not an independent coach prospect." };
  }

  const haystack = [
    profile.fullName,
    profile.biography,
    profile.categoryName,
    profile.username.replace(/[._]/g, " "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (NON_FITNESS_SIGNAL.test(haystack)) {
    return { ok: false, reason: "Profile looks like fashion, beauty, or lifestyle — not a fitness pro." };
  }

  const bio = profile.biography?.trim() ?? "";
  const category = profile.categoryName?.trim() ?? "";
  const hasFitnessCategory = FITNESS_CATEGORY.test(category);

  if (!bio && !category) {
    return {
      ok: false,
      reason: "Could not read a public coaching bio — profile may be private or not fitness-focused.",
    };
  }

  if (profile.verifiedVia === "html" && !bio && !hasFitnessCategory) {
    return {
      ok: false,
      reason: "Could not confirm coaching services from this profile — need a public fitness bio.",
    };
  }

  if (!FITNESS_SIGNAL.test(haystack) && !hasFitnessCategory) {
    return {
      ok: false,
      reason: "Bio does not show personal training, coaching, or nutrition services.",
    };
  }

  return { ok: true, niche: inferNiche(haystack) };
}

function inferNiche(text: string): string {
  if (/\bnutrition|\bdietitian|\brd\b|\bmacro\b/i.test(text)) return "Nutrition coaching";
  if (/\bstrength|\bs&c|powerlifting/i.test(text)) return "Strength coaching";
  if (/\bvirtual|online\s+coach/i.test(text)) return "Online fitness coaching";
  if (/\bpilates|yoga/i.test(text)) return "Pilates / yoga coaching";
  if (/\bcrossfit|hiit/i.test(text)) return "CrossFit / HIIT coaching";
  return "Personal training & coaching";
}

export const OUTREACH_FITNESS_PRO_CRITERIA = `
TARGET — independent fitness professionals building their coaching brand:
- Personal trainers (in-person or hybrid)
- Online fitness / strength / HIIT coaches
- Sports performance coaches
- Nutrition coaches, dietitians, and macro coaches who work with training clients

GOOD FIT SIGNALS:
- Public profile with coaching, training, or nutrition services in the bio
- Links to booking, coaching application, gym, or training programs
- Mid-size creator (roughly 1k–150k followers) actively building a coaching business

STRICT EXCLUSIONS — never include:
- Private accounts
- Fashion designers, models, beauty/makeup brands, boutiques, photographers
- Celebrities, TV personalities, or mega-influencers (500k+ followers / household names)
- Gyms/chains/supplement brands (must be an individual coach or small coaching brand)
- Generic lifestyle influencers with no clear training/nutrition offer
- Invented or guessed usernames — only profiles you are confident are real and public
`.trim();
