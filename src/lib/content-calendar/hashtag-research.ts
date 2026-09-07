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
import { createNiBrainClient, isNiBrainConfigured, recordContentLearning } from "@/lib/ni-brain-client";

export type HashtagResearchSnapshot = {
  researchedAt: string;
  usedWebSearch: boolean;
  provider: string | null;
  hashtags: string[];
  trends: string[];
  notes: string | null;
};

/**
 * Live web-search cap. Was 120_000 — long enough that a single serverless invocation of the
 * daily/weekly content-generation cron was killed by Vercel's function timeout BEFORE it wrote a
 * single post (proven live 2026-09-07: the daily endpoint returned 504 FUNCTION_INVOCATION_TIMEOUT
 * and zero rows landed). The web search now runs at most once per 24h (see the cache below) and,
 * when it does run, is capped well under the function budget so an empty/slow search falls back to
 * the static high-volume tag set instead of eating the whole invocation.
 */
const HASHTAG_RESEARCH_TIMEOUT_MS = 25_000;

/** A stored snapshot this new or newer is reused as-is; older forces a fresh live search. */
export const HASHTAG_RESEARCH_FRESHNESS_MS = 24 * 60 * 60 * 1000;

/** Narrows an untyped `meta_json.snapshot` blob back into a HashtagResearchSnapshot, or null. */
function coerceSnapshot(value: unknown): HashtagResearchSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.researchedAt !== "string") return null;
  if (!Array.isArray(v.hashtags)) return null;
  const hashtags = v.hashtags.filter((t): t is string => typeof t === "string");
  if (!hashtags.length) return null;
  return {
    researchedAt: v.researchedAt,
    usedWebSearch: v.usedWebSearch === true,
    provider: typeof v.provider === "string" ? v.provider : null,
    hashtags,
    trends: Array.isArray(v.trends) ? v.trends.filter((t): t is string => typeof t === "string") : [],
    notes: typeof v.notes === "string" ? v.notes : null,
  };
}

/**
 * Returns the most recent persisted hashtag snapshot when it is still fresh (≤ 24h), else null.
 * Snapshots are written by researchTrendingHashtags itself into match_fit_content_learning_signals
 * (signal_type "HASHTAG_RESEARCH", meta_json.snapshot) — no new table/migration. A fresh hit means
 * the hot path does ZERO live web search, which is the whole point of this cache. Any read failure
 * degrades silently to "no cache" so a cache miss can never break generation.
 */
export async function readFreshCachedHashtagSnapshot(now = Date.now()): Promise<HashtagResearchSnapshot | null> {
  if (!isNiBrainConfigured()) return null;
  try {
    const client = createNiBrainClient();
    const { data, error } = await client
      .from("match_fit_content_learning_signals")
      .select("meta_json, created_at")
      .eq("signal_type", "HASHTAG_RESEARCH")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const meta = (data.meta_json ?? null) as { snapshot?: unknown } | null;
    const snapshot = coerceSnapshot(meta?.snapshot);
    if (!snapshot) return null;
    const researchedMs = Date.parse(snapshot.researchedAt);
    if (!Number.isFinite(researchedMs)) return null;
    if (now - researchedMs > HASHTAG_RESEARCH_FRESHNESS_MS) return null;
    return snapshot;
  } catch {
    return null;
  }
}

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
  /** Skip the 24h cache and force a fresh live search (e.g. the manual "run research now" button). */
  forceRefresh?: boolean;
}): Promise<HashtagResearchSnapshot> {
  await hydratePlatformEnvFromDatabase();

  // Cache-first: a fresh (≤24h) snapshot means NO live web search on this run. This is what keeps
  // the daily/weekly generation cron inside the serverless timeout so it actually writes its posts
  // — the 120s live search that used to run on every invocation was killing the function first.
  if (!args?.forceRefresh) {
    const cached = await readFreshCachedHashtagSnapshot();
    if (cached) return cached;
  }

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

  let ai: Awaited<ReturnType<typeof callMatchFitAi>>;
  try {
    ai = await callMatchFitAi({
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
  } catch {
    // Short-timeout abort or any provider error → static high-volume set, never a stuck function.
    return fallback;
  }

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
    // `snapshot` is the full structured cache payload readFreshCachedHashtagSnapshot reads back — the
    // 24h freshness cache lives entirely in this row, no new table.
    meta: {
      researchedAt,
      usedWebSearch: snapshot.usedWebSearch,
      trends: snapshot.trends,
      source: "weekly_generation",
      snapshot,
    },
  });

  return snapshot;
}
