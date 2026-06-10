import "server-only";

import type { InstagramProfileVerification } from "@/lib/instagram-profile-verify";

const FITNESS_STRONG =
  /\b(personal\s+train|online\s+coach|fitness\s+coach|strength\s+coach|nutrition(ist)?|dietitian|\brd\b|\bl\d\b|coach(ing)?|trainer|training|workout|crossfit|pilates|yoga\s+instruct|sports?\s+performance|health\s+coach|wellness\s+coach|virtual\s+coach|1[:\-]1\s+coaching|macro\s+coach|prep\s+coach|nasm|ace|cscs|corrective\s+exercise|s&c|sports?\s+nutrition|fit\s+pro|fitness\s+pro|body\s+transform|fat\s+loss|muscle\s+gain|hypertrophy|powerlifting|bodybuilding|bootcamp|group\s+fitness|semi[\-\s]?private|in[\-\s]?person\s+train|remote\s+coach)\b/i;

const FITNESS_SOFT =
  /\b(fitness|fitfam|fitlife|gym|lift|lifting|strong|strength|athlete|transformation|results|program|programs|nutrition|wellness|healthy|health|sweat|train|coaching|movement|mobility|recovery|hiit|cardio|bodybuilding|physique|lean|shred|gains|swole|fit\b)\b/i;

const FITNESS_USERNAME =
  /\b(coach|trainer|train|fit|fitness|gym|lift|lifting|gains|swole|physique|strength|crossfit|pilates|yoga|nutrition|macro|pt\b|onlinecoach|fitpro|fitfam)\b/i;

const FITNESS_CATEGORY =
  /\b(fitness\s+trainer|personal\s+trainer|coach|athlete|gym|fitness|health|wellness|sports?\s+team|nutrition)\b/i;

const NON_FITNESS_STRONG =
  /\b(fashion\s+design|fashion\s+designer|boutique\s+owner|jewelry|jewellery|makeup\s+artist|mua\b|beauty\s+brand|wedding\s+photographer|real\s+estate|realtor|crypto|nft|clothing\s+brand|streetwear|salon\s+owner|hairstyl|nail\s+tech|lash\s+tech|skincare\s+brand)\b/i;

const NON_FITNESS_WEAK =
  /\b(model(ing)?|photographer|wedding|bridal|artist|art\s+studio|musician|rapper|dj\b|apparel|boutique|designer)\b/i;

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
const MIN_FITNESS_SCORE = 22;

export type FitnessProScore = {
  score: number;
  tier: "verified" | "likely" | "review";
  signals: string[];
  niche: string;
};

export function scoreFitnessProfessionalText(input: {
  fullName?: string | null;
  biography?: string | null;
  categoryName?: string | null;
  username?: string | null;
  niche?: string | null;
  businessName?: string | null;
  pageName?: string | null;
}): FitnessProScore {
  const haystack = [
    input.fullName,
    input.biography,
    input.categoryName,
    input.niche,
    input.businessName,
    input.pageName,
    input.username?.replace(/[._]/g, " "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const signals: string[] = [];
  let score = 0;

  if (FITNESS_STRONG.test(haystack)) {
    score += 42;
    signals.push("coaching/training services in profile text");
  } else if (FITNESS_SOFT.test(haystack)) {
    score += 24;
    signals.push("general fitness language in profile text");
  }

  if (input.categoryName && FITNESS_CATEGORY.test(input.categoryName)) {
    score += 28;
    signals.push("fitness-related Instagram category");
  }

  if (input.username && FITNESS_USERNAME.test(input.username.replace(/[._]/g, " "))) {
    score += 18;
    signals.push("fitness-related username");
  } else if (input.username && /(coach|trainer|train|fitness|fitpro|fitfam|gym|lift|nutrition|crossfit|pilates|yoga)/i.test(input.username)) {
    score += 16;
    signals.push("fitness hint in username");
  }

  if (/\b(linktr\.ee|calendly|book|booking|apply|coach\.me|trainerize|truecoach)\b/i.test(haystack)) {
    score += 12;
    signals.push("booking or coaching link");
  }

  if (NON_FITNESS_STRONG.test(haystack)) {
    score -= 55;
    signals.push("strong non-fitness industry signals");
  } else if (NON_FITNESS_WEAK.test(haystack) && !FITNESS_STRONG.test(haystack) && !FITNESS_SOFT.test(haystack)) {
    score -= 28;
    signals.push("possible lifestyle/non-fitness signals");
  }

  const tier = score >= 55 ? "verified" : score >= MIN_FITNESS_SCORE ? "likely" : "review";
  return { score, tier, signals, niche: inferNiche(haystack) };
}

export function assessFitnessProfessionalProfile(
  profile: Extract<InstagramProfileVerification, { ok: true }> & {
    categoryName?: string | null;
    followerCount?: number | null;
  },
): { ok: true; niche: string; tier: FitnessProScore["tier"]; fitnessScore: number } | { ok: false; reason: string } {
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

  const scored = scoreFitnessProfessionalText({
    fullName: profile.fullName,
    biography: profile.biography,
    categoryName: profile.categoryName,
    username: profile.username,
  });

  const fitnessScore = scored.score + 8;
  const tier =
    fitnessScore >= 55 ? "verified" : fitnessScore >= MIN_FITNESS_SCORE ? "likely" : "review";

  const haystack = [profile.fullName, profile.biography, profile.categoryName, profile.username]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (NON_FITNESS_STRONG.test(haystack) && fitnessScore < MIN_FITNESS_SCORE) {
    return { ok: false, reason: "Profile looks like fashion, beauty, or lifestyle — not a fitness pro." };
  }

  if (fitnessScore < MIN_FITNESS_SCORE) {
    return {
      ok: false,
      reason: "Profile doesn't look like a fitness pro — no clear training, coaching, or nutrition signals.",
    };
  }

  return {
    ok: true,
    niche: scored.niche,
    tier,
    fitnessScore,
  };
}

export function assessFitnessProfessionalLeadText(input: {
  name?: string | null;
  email?: string | null;
  businessName?: string | null;
  niche?: string | null;
  pageName?: string | null;
  whyMatchFit?: string | null;
  notes?: string | null;
}): { ok: true; niche: string; tier: FitnessProScore["tier"]; fitnessScore: number } | { ok: false; reason: string } {
  const scored = scoreFitnessProfessionalText({
    fullName: input.name,
    biography: [input.whyMatchFit, input.notes].filter(Boolean).join(" "),
    niche: input.niche,
    businessName: input.businessName,
    pageName: input.pageName,
  });

  if (scored.score < MIN_FITNESS_SCORE) {
    return {
      ok: false,
      reason: "Lead doesn't look like a fitness pro — no clear training, coaching, or nutrition focus.",
    };
  }

  return {
    ok: true,
    niche: input.niche?.trim() || scored.niche,
    tier: scored.tier,
    fitnessScore: scored.score,
  };
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
TARGET — fitness professionals building their coaching or training brand:
- Personal trainers (in-person, hybrid, or gym-based)
- Online fitness, strength, HIIT, or sports performance coaches
- Nutrition coaches, dietitians, and macro coaches who work with training clients
- Small coaching brands run by an individual trainer (not big gym chains)

GOOD FIT SIGNALS (any of these count — do not require all):
- Bio mentions training, coaching, workouts, nutrition, or transformation programs
- Username or display name includes coach, trainer, fit, gym, lift, nutrition, etc.
- Links to booking, coaching application, gym, or training programs
- Mid-size creator actively building a coaching business (roughly 1k–150k followers on Instagram)

HARD EXCLUSIONS — never include:
- Private Instagram accounts
- Fashion designers, models, beauty/makeup brands, boutiques, photographers, real estate, crypto
- Celebrities or mega-influencers (500k+ followers / household names)
- Large gym chains or supplement brands (must be an individual coach or small coaching brand)
- Invented or guessed usernames, emails, or URLs — only real profiles you are confident exist
`.trim();

export const OUTREACH_INSTAGRAM_CRITERIA = `
${OUTREACH_FITNESS_PRO_CRITERIA}

INSTAGRAM-SPECIFIC:
- Only public profiles you can verify exist (@handle must resolve on instagram.com)
- Prefer independent coaches over celebrity trainers
- ATL_LOCAL: Atlanta metro personal trainers, strength coaches, hybrid coaches with local presence
- VIRTUAL: online coaches, remote personal trainers, nutrition coaches, virtual training brands
`.trim();

export const OUTREACH_FACEBOOK_CRITERIA = `
${OUTREACH_FITNESS_PRO_CRITERIA}

FACEBOOK-SPECIFIC:
- Active Facebook pages or groups where personal trainers and fitness coaches participate
- Audience should be TRAINER when the page/group is for coaches; CLIENT only if it's a client community you can post trainer-recruiting copy in
- ATL_LOCAL: Atlanta-area trainer groups, local gym communities, metro fitness business pages
- Focus on places a Match Fit founder post would reach working personal trainers
`.trim();

export const OUTREACH_EMAIL_CRITERIA = `
${OUTREACH_FITNESS_PRO_CRITERIA}

EMAIL-SPECIFIC:
- Public contact emails for independent personal trainers, online coaches, or small training businesses
- emailSourceUrl must point to where the email was found (website contact page, trainer directory, bio link page)
- Do not invent emails — only addresses published publicly by the trainer or their business
- ATL_LOCAL: Atlanta metro trainers with a business email on their site or directory listing
- VIRTUAL: online coaches with a public contact or coaching inquiry email
`.trim();
