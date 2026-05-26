export type MatchFitOfficialSocialPlatform = "instagram" | "threads" | "facebook" | "tiktok";

export type MatchFitOfficialSocialLink = {
  platform: MatchFitOfficialSocialPlatform;
  label: string;
  href: string;
};

/** Match Fit-owned social profiles (marketing / community). */
export const MATCH_FIT_OFFICIAL_SOCIAL_LINKS: readonly MatchFitOfficialSocialLink[] = [
  {
    platform: "instagram",
    label: "Instagram",
    href: "https://www.instagram.com/theofficialmatchfit/",
  },
  {
    platform: "threads",
    label: "Threads",
    href: "https://www.threads.com/@theofficialmatchfit",
  },
  {
    platform: "tiktok",
    label: "TikTok",
    href: "https://www.tiktok.com/@theofficialmatchfit",
  },
  {
    platform: "facebook",
    label: "Facebook",
    href: "https://www.facebook.com/1162533296938793",
  },
  {
    platform: "tiktok",
    label: "TikTok",
    href: "https://www.tiktok.com/@theofficialmatchfit",
    platform: "instagram",
    label: "Instagram",
    href: "https://www.instagram.com/theofficialmatchfit/",
  },
] as const;
