import "server-only";

import { CONTENT_CALENDAR_FOUNDING_PROMO_FACTS } from "@/lib/content-calendar/content-rules";
import { scanMatchFitWebsite, type WebsiteScanResult } from "@/lib/content-calendar/website-scan";
import { scanMatchFitSocialProfiles, type SocialProfileScanResult } from "@/lib/content-calendar/social-profile-scan";
import { fetchNiBrainMatchFitContext, fetchRecentContentLearnings } from "@/lib/ni-brain-client";
import { fetchWinningAngleLines } from "@/lib/marketing/skeleton";
import { MATCH_FIT_OFFICIAL_SOCIAL_LINKS } from "@/lib/match-fit-official-social";
import { buildDpmoSimulationContext } from "@/lib/content-calendar/dpmo-simulation-context";

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

  const [niContext, learnings, website, social, winningAngles, dpmoSimulation] = await Promise.all([
    fetchNiBrainMatchFitContext(),
    fetchRecentContentLearnings(),
    includeWebsite ? getWebsiteScanContext(force) : null,
    includeSocial ? getSocialScanContext(force) : null,
    fetchWinningAngleLines().catch(() => [] as string[]),
    buildDpmoSimulationContext("Match Fit").catch(() => ""),
  ]);

  const socialUrls = MATCH_FIT_OFFICIAL_SOCIAL_LINKS.map((l) => `${l.label}: ${l.href}`).join("\n");

  return [
    // Craft lock = the few hard facts we never break. It NO LONGER forces "Fitness Pro" — JB's
    // operator learnings below now win on wording. Hard facts only: worldwide, canonical CTA,
    // carousel shape, founding promo meaning.
    `Craft lock (hard facts — never break): Match Fit is WORLDWIDE, never "nationwide"/place-based; CTA match-fit.net/trainer/sign-up; carousel captions = static-style; ${CONTENT_CALENDAR_FOUNDING_PROMO_FACTS}`,
    // Social wording lock: lead with trending terms, not our internal brand term.
    `Social wording (JB 2026-09-03): lead with trending, widely-understood words — "coach", "trainer", "personal trainer". "Fitness Pro" is our internal term; use it sparingly, never lead with it until the brand is established. Follow the operator learnings below over any generic wording habit.`,
    niContext ? `NI Brain context:\n${niContext.slice(0, 1500)}` : "",
    learnings.length
      ? `Recent operator learnings (APPLY THESE — they reflect JB's own edits and win on tone, wording and structure):\n${learnings.join("\n")}`
      : "",
    winningAngles.length
      ? `Marketing skeleton — current winning angles (lead with these, revenue-proven):\n${winningAngles.join("\n")}`
      : "",
    dpmoSimulation || "",
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
