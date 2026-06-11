import type { OutreachLeadProfileSnapshot, OutreachPlatform } from "@/lib/outreach-types";

type InstagramRow = {
  handle: string;
  niche: string;
  targetGroup: string;
  whyMatchFit: string;
  likelihoodScore: number;
  status: string;
};

type FacebookRow = {
  pageName: string;
  niche: string | null;
  targetGroup: string;
  whyMatchFit: string;
  likelihoodScore: number;
  status: string;
};

type EmailRow = {
  name: string;
  email: string;
  niche: string | null;
  targetGroup: string;
  whyMatchFit: string;
  likelihoodScore: number;
  status: string;
};

export function instagramLeadProfile(row: InstagramRow): OutreachLeadProfileSnapshot {
  return {
    platform: "instagram",
    handle: row.handle,
    niche: row.niche,
    targetGroup: row.targetGroup,
    whyMatchFit: row.whyMatchFit,
    likelihoodScore: row.likelihoodScore,
    status: row.status,
  };
}

export function facebookLeadProfile(row: FacebookRow): OutreachLeadProfileSnapshot {
  return {
    platform: "facebook",
    pageName: row.pageName,
    niche: row.niche,
    targetGroup: row.targetGroup,
    whyMatchFit: row.whyMatchFit,
    likelihoodScore: row.likelihoodScore,
    status: row.status,
  };
}

export function emailLeadProfile(row: EmailRow): OutreachLeadProfileSnapshot {
  return {
    platform: "email",
    name: row.name,
    email: row.email,
    niche: row.niche,
    targetGroup: row.targetGroup,
    whyMatchFit: row.whyMatchFit,
    likelihoodScore: row.likelihoodScore,
    status: row.status,
  };
}

export function leadProfileForPlatform(
  platform: OutreachPlatform,
  row: InstagramRow | FacebookRow | EmailRow,
): OutreachLeadProfileSnapshot {
  if (platform === "instagram") return instagramLeadProfile(row as InstagramRow);
  if (platform === "facebook") return facebookLeadProfile(row as FacebookRow);
  return emailLeadProfile(row as EmailRow);
}
