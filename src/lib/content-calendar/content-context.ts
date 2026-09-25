import "server-only";

import { CONTENT_CALENDAR_FOUNDING_PROMO_FACTS } from "@/lib/content-calendar/content-rules";
import { scanMatchFitWebsite, type WebsiteScanResult } from "@/lib/content-calendar/website-scan";
import { scanMatchFitSocialProfiles, type SocialProfileScanResult } from "@/lib/content-calendar/social-profile-scan";
import { fetchNiBrainMatchFitContext, fetchRecentContentLearnings } from "@/lib/ni-brain-client";
import { fetchWinningAngleLines } from "@/lib/marketing/skeleton";
import { MATCH_FIT_OFFICIAL_SOCIAL_LINKS } from "@/lib/match-fit-official-social";
import { buildDpmoSimulationContext } from "@/lib/content-calendar/dpmo-simulation-context";

import { listRecentResearchRuns, fetchRecentAxonMatchFitFindings } from "@/lib/content-calendar/content-research-store";
import { createNiBrainClient, isNiBrainConfigured } from "@/lib/ni-brain-client";
import {
  CONTENT_EXPERIMENT_28_DAY,
  MATCH_FIT_AVATAR_IMAGE_PATH,
  MATCH_FIT_AVATAR_NAME,
} from "@/lib/content-calendar/constants";

let cachedWebsiteScan: { at: number; result: WebsiteScanResult } | null = null;
let cachedSocialScan: { at: number; result: SocialProfileScanResult } | null = null;

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function fetchPlatformPerformanceAnalytics(): Promise<string> {
  if (!isNiBrainConfigured()) return "";
  try {
    const client = createNiBrainClient();
    const { data } = await client
      .from("match_fit_social_performance")
      .select("platform, post_type, metrics_json, notes, ai_summary")
      .order("recorded_at", { ascending: false })
      .limit(10);
    if (!data || data.length === 0) return "";
    return data
      .map(
        (r) =>
          `- [${r.platform} · ${r.post_type}]: ${r.ai_summary || r.notes || JSON.stringify(r.metrics_json)}`,
      )
      .join("\n");
  } catch {
    return "";
  }
}

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

  const [
    niContext,
    learnings,
    website,
    social,
    winningAngles,
    dpmoSimulation,
    recentResearchRuns,
    axonFindings,
    platformAnalytics,
  ] = await Promise.all([
    fetchNiBrainMatchFitContext(),
    fetchRecentContentLearnings(),
    includeWebsite ? getWebsiteScanContext(force) : null,
    includeSocial ? getSocialScanContext(force) : null,
    fetchWinningAngleLines().catch(() => [] as string[]),
    buildDpmoSimulationContext("Match Fit").catch(() => ""),
    listRecentResearchRuns(3).catch(() => []),
    fetchRecentAxonMatchFitFindings(5).catch(() => []),
    fetchPlatformPerformanceAnalytics().catch(() => ""),
  ]);

  const socialUrls = MATCH_FIT_OFFICIAL_SOCIAL_LINKS.map((l) => `${l.label}: ${l.href}`).join("\n");

  const dailyMarketResearchLines: string[] = [];
  for (const run of recentResearchRuns) {
    if (run.summary?.trim()) {
      dailyMarketResearchLines.push(`- [Daily Market Run ${run.run_date}]: ${run.summary.trim()}`);
    }
  }
  for (const item of axonFindings) {
    if (item.text?.trim()) {
      dailyMarketResearchLines.push(`- [AXON Finding${item.date ? ` ${item.date}` : ""}]: ${item.text.trim()}`);
    }
  }

  return [
    // Craft lock = the few hard facts we never break.
    `Craft lock (hard facts — never break): Match Fit is WORLDWIDE, never "nationwide"/place-based; CTA match-fit.net/trainer/sign-up; carousel captions = static-style; ${CONTENT_CALENDAR_FOUNDING_PROMO_FACTS}`,
    // Social wording lock: lead with trending terms, not our internal brand term.
    `Social wording (JB 2026-09-03): lead with trending, widely-understood words — "coach", "trainer", "personal trainer". "Fitness Pro" is our internal term; use it sparingly, never lead with it until the brand is established. Follow the operator learnings below over any generic wording habit.`,
    // Clean formatting and emoji mandates (JB 2026-09-24):
    `Strict Visual & Copywriting Rules: (1) NO MARKDOWN BOLDING (**) — never output asterisks in captions or text posts. Output clean plain text only. (2) Mandatory Emojis: use 2–4 eye-catching emojis per post naturally integrated into captions and hooks.`,
    // 28-Day Archetype Mix:
    `28-Day Content Experiment (${CONTENT_EXPERIMENT_28_DAY.startDate} – ${CONTENT_EXPERIMENT_28_DAY.endDate}): 10 posts/week mix across 3 archetypes: (1) 3 Generic Informational Ads, (2) 4 UGC talking-head posts featuring official avatar "${MATCH_FIT_AVATAR_NAME}" (mandatory character reference: ${MATCH_FIT_AVATAR_IMAGE_PATH}), (3) 1 Cinematic Trailer (must be Video format), plus 2 Text posts.`,
    dailyMarketResearchLines.length
      ? `Daily Market & Competitor Research (IMPLEMENT THESE FINDINGS):\n${dailyMarketResearchLines.join("\n")}`
      : "",
    platformAnalytics
      ? `Social Media Platform Analytics (What worked on every platform):\n${platformAnalytics}`
      : "",
    learnings.length
      ? `Recent operator learnings & previous edits (APPLY THESE — they reflect JB's edits and win on tone, wording, and structure):\n${learnings.join("\n")}`
      : "",
    dpmoSimulation
      ? `DPMO Monte Carlo & Growth Phase Context (REVIEW THIS — align post angles with current phase metrics):\n${dpmoSimulation}`
      : "",
    winningAngles.length
      ? `Marketing skeleton — current winning angles (lead with these, revenue-proven):\n${winningAngles.join("\n")}`
      : "",
    niContext ? `NI Brain context:\n${niContext.slice(0, 1500)}` : "",
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
