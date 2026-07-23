import "server-only";

import { CONTENT_CALENDAR_FOUNDING_PROMO_FACTS } from "@/lib/content-calendar/content-rules";
import { scanMatchFitWebsite, type WebsiteScanResult } from "@/lib/content-calendar/website-scan";
import { scanMatchFitSocialProfiles, type SocialProfileScanResult } from "@/lib/content-calendar/social-profile-scan";
import { fetchNiBrainMatchFitContext, fetchRecentContentLearnings } from "@/lib/ni-brain-client";
import { fetchWinningAngleLines } from "@/lib/marketing/skeleton";
import { MATCH_FIT_OFFICIAL_SOCIAL_LINKS } from "@/lib/match-fit-official-social";

let cachedWebsiteScan: { at: number; result: WebsiteScanResult } | null = null;
let cachedSocialScan: { at: number; result: SocialProfileScanResult } | null = null;

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function getWebsiteScanContext(force = false): Promise<WebsiteScanResult> {
  const now = Date.now();
  if (!force && cachedWebsiteScan && now - cachedWebsiteScan.at < CACHE_TTL_MS) {
    return cachedWebsiteScan.result;
  }
  const result = await scanMatchFitWebsite();
  cachedWebsiteScan = { at: now, result };
  return result;
}

export async function getSocialScanContext(force = false): Promise<SocialProfileScanResult> {
  const now = Date.now();
  if (!force && cachedSocialScan && now - cachedSocialScan.at < CACHE_TTL_MS) {
    return cachedSocialScan.result;
  }
  const result = await scanMatchFitSocialProfiles();
  cachedSocialScan = { at: now, result };
  return result;
}

export async function buildContentGenerationContext(options?: {
  includeWebsite?: boolean;
  includeSocial?: boolean;
  forceRefresh?: boolean;
}): Promise<string> {
  const includeWebsite = options?.includeWebsite !== false;
  const includeSocial = options?.includeSocial !== false;
  const force = options?.forceRefresh === true;

  const [niContext, learnings, website, social, winningAngles] = await Promise.all([
    fetchNiBrainMatchFitContext(),
    fetchRecentContentLearnings(),
    includeWebsite ? getWebsiteScanContext(force) : null,
    includeSocial ? getSocialScanContext(force) : null,
    fetchWinningAngleLines().catch(() => [] as string[]),
  ]);

  const socialUrls = MATCH_FIT_OFFICIAL_SOCIAL_LINKS.map((l) => `${l.label}: ${l.href}`).join("\n");

  return [
    `Craft lock (overrides stale learnings): say Fitness Pros not Coaches; CTA match-fit.net/trainer/sign-up; carousel captions = static-style; ${CONTENT_CALENDAR_FOUNDING_PROMO_FACTS}`,
    niContext ? `NI Brain context:\n${niContext.slice(0, 1500)}` : "",
    learnings.length
      ? `Recent operator learnings (prefer tone/structure — but never violate craft lock above):\n${learnings.join("\n")}`
      : "",
    winningAngles.length
      ? `Marketing skeleton — current winning angles (lead with these, revenue-proven):\n${winningAngles.join("\n")}`
      : "",
    website ? `Live website scan (promos + home):\n${website.summary.slice(0, 2000)}` : "",
    social ? `Live social profile scan (use only fetched data):\n${social.summary.slice(0, 2500)}` : "",
    `Official social profiles:\n${socialUrls}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Clears in-memory scan caches (tests). */
export function resetContentContextCache(): void {
  cachedWebsiteScan = null;
  cachedSocialScan = null;
}
