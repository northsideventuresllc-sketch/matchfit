import "server-only";

import { callMatchFitAi } from "@/lib/ai-vault/router";
import { getAiVaultStatus } from "@/lib/ai-vault";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import {
  CONTENT_CALENDAR_BRAND_FACTS,
  CONTENT_CALENDAR_DAYS_LONG,
  CONTENT_CALENDAR_GROUPS,
  CONTENT_CALENDAR_WEEKDAY_POST_TYPES,
  type ContentCalendarPostType,
} from "@/lib/content-calendar/constants";
import { getMatchFitDpmoPhase } from "@/lib/content-calendar/cowork-jobs";
import { generateBulkContent } from "@/lib/content-calendar/content-calendar-ai";
import { buildContentGenerationContext, resetContentContextCache } from "@/lib/content-calendar/content-context";
import { buildMediaGenerationPrompt, type MediaPostType } from "@/lib/content-calendar/content-prompts";
import { researchTrendingHashtags, type HashtagResearchSnapshot } from "@/lib/content-calendar/hashtag-research";
import { getContentCalendarRotation, addWeekdays, formatCalendarDate, getMondayOfWeek } from "@/lib/content-calendar/rotation";
import { scanAndRecordSocialProfiles } from "@/lib/content-calendar/social-profile-scan";
import { createV2Draft } from "@/lib/content-calendar/content-calendar-v2-store";
import { normalizeTargetGroup } from "@/lib/content-calendar/content-rules";

const WEEKLY_GENERATION_ADMIN_ID = "cron_weekly_generate";

export type WeeklyDayPlan = {
  dayIndex: number;
  theme: string;
  targetAudience: string;
  cta: string;
  dpmoRationale: string;
};

export type WeeklyGenerationResult = {
  weekStart: string;
  dpmoPhase: string | null;
  socialScanSnapshotId: string;
  hashtagCount: number;
  createdPostCount: number;
  days: { dayIndex: number; postDate: string; created: number }[];
};

export type WeeklyPlanResult = {
  weekStart: string;
  dpmoPhase: string | null;
  socialScanSnapshotId: string;
  hashtags: HashtagResearchSnapshot;
  plan: WeeklyDayPlan[];
};

function parseJsonBlock<T>(text: string): T | null {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const arr = cleaned.match(/\[[\s\S]*\]/)?.[0];
    if (arr) {
      try {
        return JSON.parse(arr) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function fallbackDayPlan(dpmoPhase: string | null): WeeklyDayPlan[] {
  return [0, 1, 2, 3, 4].map((dayIndex) => {
    const rot = getContentCalendarRotation(dayIndex, 0);
    const targetAudience = rot.Static;
    return {
      dayIndex,
      theme: `${CONTENT_CALENDAR_DAYS_LONG[dayIndex]} — ${targetAudience} spotlight`,
      targetAudience,
      cta:
        targetAudience === "Clients"
          ? "Drive to match-fit.net/client/sign-up"
          : "Drive to match-fit.net/trainer/sign-up",
      dpmoRationale: dpmoPhase
        ? `Supports ${dpmoPhase}: focuses this day on ${targetAudience} to move the current growth phase forward.`
        : `Focuses this day on ${targetAudience} growth.`,
    };
  });
}

async function planWeek(args: {
  dpmoPhase: string | null;
  socialSummary: string;
  hashtags: HashtagResearchSnapshot;
  contextBlock: string;
}): Promise<WeeklyDayPlan[]> {
  const vault = getAiVaultStatus();
  if (!vault.configured) return fallbackDayPlan(args.dpmoPhase);

  const system = [
    "You are Match Fit's weekly content strategist.",
    CONTENT_CALENDAR_BRAND_FACTS,
    `Current DPMO growth phase: ${args.dpmoPhase ?? "unspecified"}.`,
    "Plan Monday–Friday. Each day gets a theme, a single target audience, an audience-correct CTA, and a plain-English `dpmoRationale` (1-2 sentences) stating BOTH how the day fits the current DPMO growth phase AND the strategy behind it (why this audience/angle now). No jargon, no internal codes — write it so a founder skims it and immediately gets the point.",
    `Target audiences (use only these): ${CONTENT_CALENDAR_GROUPS.join(", ")}.`,
    "Respond with ONLY a JSON array of 5 objects (dayIndex 0=Mon..4=Fri). No prose, no markdown.",
    'Shape: [{"dayIndex":0,"theme":"...","targetAudience":"Join the Team","cta":"...","dpmoRationale":"..."}]',
  ].join("\n");

  const user = [
    args.contextBlock,
    "",
    `Live social scan:\n${args.socialSummary.slice(0, 1800)}`,
    "",
    `Trending hashtags: ${args.hashtags.hashtags.map((t) => `#${t}`).join(" ")}`,
    args.hashtags.trends.length ? `Trend notes: ${args.hashtags.trends.join(" | ")}` : "",
    "",
    "Vary the audience across the week and align each day with what the scan and trends suggest.",
  ]
    .filter(Boolean)
    .join("\n");

  const ai = await callMatchFitAi({
    system,
    user,
    maxTokens: 1600,
    temperature: 0.5,
    jsonMode: true,
    kind: "json",
  });
  const parsed = ai.text ? parseJsonBlock<WeeklyDayPlan[]>(ai.text) : null;
  if (!parsed || !Array.isArray(parsed) || parsed.length < 5) return fallbackDayPlan(args.dpmoPhase);

  return [0, 1, 2, 3, 4].map((dayIndex) => {
    const row = parsed.find((p) => Number(p.dayIndex) === dayIndex) ?? parsed[dayIndex];
    const fallback = fallbackDayPlan(args.dpmoPhase)[dayIndex];
    return {
      dayIndex,
      theme: row?.theme?.trim() || fallback.theme,
      targetAudience: normalizeTargetGroup(row?.targetAudience || fallback.targetAudience),
      cta: row?.cta?.trim() || fallback.cta,
      dpmoRationale: row?.dpmoRationale?.trim() || fallback.dpmoRationale,
    };
  });
}

/**
 * Shared prep for the Monday weekly generation pipeline: reads the current DPMO phase, runs a
 * social scan across TikTok / Instagram / Threads / Facebook, researches trending hashtags via
 * web search, and plans the week (theme/audience/CTA per day). Split out from the per-day
 * generation loop (see {@link generateWeeklyDayPosts}) so the cron route can run this once and
 * then fan each day out to its own HTTP hop with a fresh maxDuration budget, instead of one
 * request looping all 5 days' AI calls sequentially — see MF-CONTENT-GEN-VERCEL-504-0907, where
 * that combined loop 504'd past the deploy plan's real function-duration cap.
 */
export async function planWeeklyGeneration(args?: { weekStart?: string }): Promise<WeeklyPlanResult> {
  await hydratePlatformEnvFromDatabase();
  resetContentContextCache();

  const dpmoPhase = await getMatchFitDpmoPhase();
  const social = await scanAndRecordSocialProfiles();
  const hashtags = await researchTrendingHashtags({ dpmoPhase, socialSummary: social.summary });
  const socialScanSnapshotId = `scan_${Date.parse(social.scannedAt) || Date.now()}`;

  const weekStart = args?.weekStart ?? formatCalendarDate(getMondayOfWeek());
  const contextBlock = await buildContentGenerationContext({ forceRefresh: true });

  const plan = await planWeek({ dpmoPhase, socialSummary: social.summary, hashtags, contextBlock });

  return { weekStart, dpmoPhase, socialScanSnapshotId, hashtags, plan };
}

/**
 * Generates and writes ONE day's locked post types (a bounded single AI call), using a plan
 * already produced by {@link planWeeklyGeneration}. Each post gets its DPMO phase snapshot, an
 * editable DPMO rationale, and the shared media prompt (dimensions + brand colors + logo) baked
 * into every media post's visual prompt.
 */
export async function generateWeeklyDayPosts(args: {
  weekStart: string;
  dpmoPhase: string | null;
  socialScanSnapshotId: string;
  hashtags: HashtagResearchSnapshot;
  dayPlan: WeeklyDayPlan;
}): Promise<{ dayIndex: number; postDate: string; created: number }> {
  const { weekStart, dpmoPhase, socialScanSnapshotId, hashtags, dayPlan } = args;
  const hashtagSnapshot = hashtags as unknown as Record<string, unknown>;
  const monday = new Date(`${weekStart}T00:00:00`);
  const postDate = formatCalendarDate(addWeekdays(monday, dayPlan.dayIndex));
  const dayFormats = CONTENT_CALENDAR_WEEKDAY_POST_TYPES[dayPlan.dayIndex];
  const items = dayFormats.map((postType) => ({
    postType,
    targetGroup: dayPlan.targetAudience,
  }));
  const customPrompt = [
    `Weekly generation — ${CONTENT_CALENDAR_DAYS_LONG[dayPlan.dayIndex]} (${postDate}).`,
    `Day theme: ${dayPlan.theme}`,
    `Target audience: ${dayPlan.targetAudience}`,
    `CTA: ${dayPlan.cta}`,
    dpmoPhase ? `DPMO phase: ${dpmoPhase} — ${dayPlan.dpmoRationale}` : dayPlan.dpmoRationale,
    `Weave in currently-trending hashtags where natural: ${hashtags.hashtags.map((t) => `#${t}`).join(" ")}`,
    `Generate exactly these locked post types for ${CONTENT_CALENDAR_DAYS_LONG[dayPlan.dayIndex]}: ${dayFormats.join(", ")}. Keep each distinct. Do not generate any other post type today.`,
  ].join("\n");

  const { drafts } = await generateBulkContent({
    items,
    scheduled: false,
    customPrompt,
    weekStart,
  });

  // Match strictly by postType via a Map — never fall back to positional indexing. A position-based
  // fallback (drafts[i]) would silently save the wrong post type's copy/prompt under the wrong slot
  // (e.g. a Carousel draft's content landing on the Video row) if the AI vault ever returns drafts
  // out of request order. Missing a postType entirely is a real failure — skip it loudly instead of
  // guessing, so it stays absent from the Hub rather than showing up mislabeled.
  const draftsByType = new Map(drafts.map((draft) => [draft.postType, draft] as const));

  let created = 0;
  for (const postType of dayFormats) {
    const draft = draftsByType.get(postType);
    if (!draft) {
      console.error(
        `[content-calendar weekly generate] AI vault did not return a draft for ${postType} on ${postDate} — skipping rather than mislabeling another type's content.`,
      );
      continue;
    }

    const visualPrompt =
      postType === "Text"
        ? null
        : buildMediaGenerationPrompt({
            postType: postType as MediaPostType,
            visualPrompt: draft.visualPrompt,
            caption: draft.caption,
            targetGroup: dayPlan.targetAudience as (typeof CONTENT_CALENDAR_GROUPS)[number],
          });

    await createV2Draft({
      draft: { ...draft, postType: postType as ContentCalendarPostType, dayIndex: dayPlan.dayIndex, postDate, visualPrompt },
      weekStart,
      lane: "scheduled",
      adminId: WEEKLY_GENERATION_ADMIN_ID,
      theme: dayPlan.theme,
      cta: dayPlan.cta,
      postDate,
      generateMedia: false,
      dpmoPhase,
      dpmoRationale: dayPlan.dpmoRationale,
      socialScanSnapshotId,
      hashtagResearchSnapshot: hashtagSnapshot,
    });
    created += 1;
  }

  return { dayIndex: dayPlan.dayIndex, postDate, created };
}

/**
 * Monday weekly generation pipeline — runs {@link planWeeklyGeneration} then
 * {@link generateWeeklyDayPosts} for every day in sequence, in one request. Used directly by
 * tests and any manual/backfill caller; the live cron route instead chains the per-day step
 * across separate HTTP hops (see that file) so production runs never share one request's time
 * budget across all 5 days.
 */
export async function runWeeklyContentGeneration(args?: { weekStart?: string }): Promise<WeeklyGenerationResult> {
  const planResult = await planWeeklyGeneration(args);

  const days: WeeklyGenerationResult["days"] = [];
  let createdPostCount = 0;

  for (const dayPlan of planResult.plan) {
    const dayResult = await generateWeeklyDayPosts({
      weekStart: planResult.weekStart,
      dpmoPhase: planResult.dpmoPhase,
      socialScanSnapshotId: planResult.socialScanSnapshotId,
      hashtags: planResult.hashtags,
      dayPlan,
    });
    days.push(dayResult);
    createdPostCount += dayResult.created;
  }

  return {
    weekStart: planResult.weekStart,
    dpmoPhase: planResult.dpmoPhase,
    socialScanSnapshotId: planResult.socialScanSnapshotId,
    hashtagCount: planResult.hashtags.hashtags.length,
    createdPostCount,
    days,
  };
}
