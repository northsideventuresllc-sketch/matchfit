import "server-only";

import { callMatchFitAi } from "@/lib/ai-vault/router";
import { getAiVaultStatus } from "@/lib/ai-vault";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { CONTENT_CALENDAR_BRAND_FACTS } from "@/lib/content-calendar/constants";
import {
  enforceHighVolumeHashtags,
  HIGH_VOLUME_HASHTAGS,
  HIGH_VOLUME_HASHTAG_RULE,
} from "@/lib/content-calendar/hashtag-policy";
import { recordContentLearning } from "@/lib/ni-brain-client";

export type HashtagResearchSnapshot = {
  researchedAt: string;
  usedWebSearch: boolean;
  provider: string | null;
  hashtags: string[];
  trends: string[];
  notes: string | null;
};

const HASHTAG_RESEARCH_TIMEOUT_MS = 120_000;

function parseJsonBlock<T>(text: string): T | null {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const obj = cleaned.match(/\{[\s\S]*\}/)?.[0];
    if (obj) {
      try {
        return JSON.parse(obj) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Researches currently-trending fitness / creator hashtags relevant to Match Fit's growth goals
 * using the AI Vault Claude-native web-search tool (same pattern as outreach-ai.ts). Falls back
 * to a static Match Fit tag set when the vault is unconfigured or web search returns nothing.
 */
export async function researchTrendingHashtags(args?: {
  dpmoPhase?: string | null;
  socialSummary?: string;
}): Promise<HashtagResearchSnapshot> {
  await hydratePlatformEnvFromDatabase();
  const researchedAt = new Date().toISOString();
  const fallback: HashtagResearchSnapshot = {
    researchedAt,
    usedWebSearch: false,
    provider: null,
    // High-volume only (JB locked rule). The old fallback led with invented/branded
    // tags (MatchFit, FitnessApp, FitHub) that nobody searches.
    hashtags: enforceHighVolumeHashtags([], { max: HIGH_VOLUME_HASHTAGS.length }),
    trends: [],
    notes: null,
  };

  const vault = getAiVaultStatus();
  if (!vault.configured) return fallback;

  const system = [
    "You are Match Fit's social hashtag trend researcher.",
    CONTENT_CALENDAR_BRAND_FACTS,
    "Use web search to find hashtags trending RIGHT NOW across Instagram, TikTok, Threads, and Facebook in fitness, personal training, online coaching, and fitness-creator niches.",
    "Prioritize tags that help Match Fit grow beta Fitness Pros and clients. Match Fit is worldwide — no city, metro or regional geo tags. No # prefix in the arrays.",
    HIGH_VOLUME_HASHTAG_RULE,
    "OUTPUT FORMAT — CRITICAL: respond with a single raw JSON object only. No prose, no markdown fences.",
    'Shape: {"hashtags":["tag1","tag2",...],"trends":["short note about a trend",...],"notes":"one-line summary of what is trending"}',
  ].join("\n");

  const user = [
    args?.dpmoPhase ? `Current growth phase: ${args.dpmoPhase}.` : "",
    args?.socialSummary ? `Recent Match Fit social scan:\n${args.socialSummary.slice(0, 1500)}` : "",
    "Return 12-20 hashtags plus a few short trend notes. Every hashtag must come from the approved high-volume list; report which of them are trending right now in the trend notes.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const ai = await callMatchFitAi({
    system,
    user,
    maxTokens: 2000,
    temperature: 0.3,
    kind: "research",
    complexity: "complex",
    timeoutMs: HASHTAG_RESEARCH_TIMEOUT_MS,
    anthropicTools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 6,
      },
    ],
  });

  if (!ai.text) return fallback;

  const parsed = parseJsonBlock<{ hashtags?: string[]; trends?: string[]; notes?: string }>(ai.text);
  // Coerce to the approved high-volume pool. This snapshot is fed into weekly
  // generation prompts, so an off-list tag here propagates into every post.
  const hashtags = enforceHighVolumeHashtags(parsed?.hashtags ?? [], {
    max: HIGH_VOLUME_HASHTAGS.length,
  });
  const snapshot: HashtagResearchSnapshot = {
    researchedAt,
    usedWebSearch: ai.provider === "anthropic",
    provider: ai.provider ?? null,
    hashtags: hashtags.length ? hashtags : fallback.hashtags,
    trends: Array.isArray(parsed?.trends) ? parsed!.trends.filter((t): t is string => typeof t === "string").slice(0, 8) : [],
    notes: parsed?.notes?.trim() || null,
  };

  await recordContentLearning({
    signalType: "HASHTAG_RESEARCH",
    editedText: [snapshot.notes, snapshot.hashtags.map((t) => `#${t}`).join(" ")].filter(Boolean).join("\n"),
    meta: { researchedAt, usedWebSearch: snapshot.usedWebSearch, trends: snapshot.trends, source: "weekly_generation" },
  });

  return snapshot;
}
