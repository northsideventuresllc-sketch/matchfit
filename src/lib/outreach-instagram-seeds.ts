import type { OutreachTargetGroup } from "@/lib/outreach-types";

/** Pre-verified public Instagram accounts for Match Fit trainer outreach. */
export type OutreachInstagramSeed = {
  username: string;
  handle: string;
  profileUrl: string;
  targetGroup: OutreachTargetGroup;
  niche: string;
  displayName: string;
};

/** Major public fitness creator/coach accounts — verified manually for outreach seeds. */
export const OUTREACH_INSTAGRAM_SEEDS: OutreachInstagramSeed[] = [
  {
    username: "theofficialmatchfit",
    handle: "@theofficialmatchfit",
    profileUrl: "https://www.instagram.com/theofficialmatchfit/",
    targetGroup: "ATL_LOCAL",
    niche: "Match Fit marketplace",
    displayName: "Match Fit",
  },
  {
    username: "blogilates",
    handle: "@blogilates",
    profileUrl: "https://www.instagram.com/blogilates/",
    targetGroup: "VIRTUAL",
    niche: "Pilates & home workouts",
    displayName: "Blogilates",
  },
  {
    username: "sydneycummings",
    handle: "@sydneycummings",
    profileUrl: "https://www.instagram.com/sydneycummings/",
    targetGroup: "VIRTUAL",
    niche: "Online HIIT coaching",
    displayName: "Sydney Cummings",
  },
  {
    username: "mindpumpmedia",
    handle: "@mindpumpmedia",
    profileUrl: "https://www.instagram.com/mindpumpmedia/",
    targetGroup: "VIRTUAL",
    niche: "Online fitness education",
    displayName: "Mind Pump",
  },
  {
    username: "stephgrasso",
    handle: "@stephgrasso",
    profileUrl: "https://www.instagram.com/stephgrasso/",
    targetGroup: "VIRTUAL",
    niche: "Online nutrition & training",
    displayName: "Steph Gasso",
  },
  {
    username: "movewithus",
    handle: "@movewithus",
    profileUrl: "https://www.instagram.com/movewithus/",
    targetGroup: "VIRTUAL",
    niche: "Online training programs",
    displayName: "Move With Us",
  },
  {
    username: "trainwithjoan",
    handle: "@trainwithjoan",
    profileUrl: "https://www.instagram.com/trainwithjoan/",
    targetGroup: "VIRTUAL",
    niche: "Online strength for women",
    displayName: "Train With Joan",
  },
  {
    username: "kayla_itsines",
    handle: "@kayla_itsines",
    profileUrl: "https://www.instagram.com/kayla_itsines/",
    targetGroup: "VIRTUAL",
    niche: "Global online coaching",
    displayName: "Kayla Itsines",
  },
  {
    username: "whitneyysimmons",
    handle: "@whitneyysimmons",
    profileUrl: "https://www.instagram.com/whitneyysimmons/",
    targetGroup: "VIRTUAL",
    niche: "Online lifting coaching",
    displayName: "Whitney Simmons",
  },
  {
    username: "athleanx",
    handle: "@athleanx",
    profileUrl: "https://www.instagram.com/athleanx/",
    targetGroup: "VIRTUAL",
    niche: "Athletic training education",
    displayName: "ATHLEAN-X",
  },
  {
    username: "chloe_t",
    handle: "@chloe_t",
    profileUrl: "https://www.instagram.com/chloe_t/",
    targetGroup: "VIRTUAL",
    niche: "Home workout coaching",
    displayName: "Chloe Ting",
  },
  {
    username: "heartandcore",
    handle: "@heartandcore",
    profileUrl: "https://www.instagram.com/heartandcore/",
    targetGroup: "VIRTUAL",
    niche: "Virtual strength coaching",
    displayName: "Heart and Core",
  },
];

function seedIsExcluded(seed: OutreachInstagramSeed, exclusions: Set<string>): boolean {
  const keys = [
    seed.username.toLowerCase(),
    seed.handle.toLowerCase(),
    seed.profileUrl.toLowerCase(),
    `@${seed.username}`.toLowerCase(),
  ];
  return keys.some((k) => exclusions.has(k));
}

/** Pick unused seed accounts for a generation batch. */
export function pickInstagramSeedLeads(args: {
  atlCount: number;
  virtualCount: number;
  exclusions: string[];
}): OutreachInstagramSeed[] {
  const excluded = new Set(args.exclusions.map((x) => x.toLowerCase().trim()).filter(Boolean));
  const atlPool = OUTREACH_INSTAGRAM_SEEDS.filter(
    (s) => s.targetGroup === "ATL_LOCAL" && !seedIsExcluded(s, excluded),
  );
  const virtualPool = OUTREACH_INSTAGRAM_SEEDS.filter(
    (s) => s.targetGroup === "VIRTUAL" && !seedIsExcluded(s, excluded),
  );

  return [
    ...atlPool.slice(0, Math.max(0, args.atlCount)),
    ...virtualPool.slice(0, Math.max(0, args.virtualCount)),
  ];
}

export function countAvailableInstagramSeeds(exclusions: string[]): { atl: number; virtual: number } {
  const excluded = new Set(exclusions.map((x) => x.toLowerCase().trim()).filter(Boolean));
  return {
    atl: OUTREACH_INSTAGRAM_SEEDS.filter((s) => s.targetGroup === "ATL_LOCAL" && !seedIsExcluded(s, excluded))
      .length,
    virtual: OUTREACH_INSTAGRAM_SEEDS.filter((s) => s.targetGroup === "VIRTUAL" && !seedIsExcluded(s, excluded))
      .length,
  };
}
