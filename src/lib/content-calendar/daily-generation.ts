import "server-only";

import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import {
  CONTENT_CALENDAR_DAYS_LONG,
  CONTENT_CALENDAR_POST_TYPES,
  type ContentCalendarPostType,
} from "@/lib/content-calendar/constants";
import { getMatchFitDpmoPhase } from "@/lib/content-calendar/cowork-jobs";
import { generateBulkContent } from "@/lib/content-calendar/content-calendar-ai";
import { resetContentContextCache } from "@/lib/content-calendar/content-context";
import { buildMediaGenerationPrompt, type MediaPostType } from "@/lib/content-calendar/content-prompts";
import { researchTrendingHashtags, type HashtagResearchSnapshot } from "@/lib/content-calendar/hashtag-research";
import { getContentCalendarRotation, addWeekdays, formatCalendarDate, getMondayOfWeek } from "@/lib/content-calendar/rotation";
import { createV2Draft } from "@/lib/content-calendar/content-calendar-v2-store";
import { normalizeTargetGroup } from "@/lib/content-calendar/content-rules";
import { createNiBrainClient } from "@/lib/ni-brain-client";

const DAILY_GENERATION_ADMIN_ID = "cron_daily_generate";

export type DailyGenerationResult =
  | { ran: false; reason: string; date: string }
  | {
      ran: true;
      weekStart: string;
      postDate: string;
      dayIndex: number;
      targetGroup: string;
      createdPostTypes: ContentCalendarPostType[];
      skippedExistingPostTypes: ContentCalendarPostType[];
      hashtagSnapshot: HashtagResearchSnapshot | null;
    };

/** Only LIVE (non-deleted) rows count as "already filled" — matches the unique index, which is
 * itself scoped `WHERE deleted_at IS NULL` (see the 2026-08-31 fix note in
 * content-calendar-v2-store.ts's resolveUniqueDayIndex, the same bug this mirrors). */
async function getExistingPostTypesForSlot(weekStart: string, dayIndex: number): Promise<Set<ContentCalendarPostType>> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .select("post_type")
    .eq("week_start", weekStart)
    .eq("day_index", dayIndex)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.post_type as ContentCalendarPostType));
}

/**
 * Daily Match Fit Content Hub generation — the "AXON agents do the research and push it to the
 * MF portal every day" pipeline JB asked for.
 *
 * This is a companion to the Monday `runWeeklyContentGeneration` (weekly-generation.ts), not a
 * replacement: the weekly job plans and drafts a full Mon-Fri week in one run (social scan +
 * hashtag research + a 5-day AI plan). This daily job runs every weekday morning, checks ONLY
 * today's Content Hub slot, and fills in whichever of the four locked post types
 * (Carousel/Static/Video/Text) are still missing — using fresh trending-hashtag research each
 * time via callMatchFitAi (AXON local Ollama first, then the free-tier fallbacks in
 * docs/ai-vault.md; no static/repeated template). That makes it self-healing: if the weekly
 * batch never ran, timed out partway through, or a day's drafts got scrapped after the fact
 * (the exact situation found live for week 2026-08-31 — see the resolveUniqueDayIndex fix),
 * today still gets a fresh set of drafts instead of staying empty until next Monday.
 *
 * Idempotent by construction: a post type already sitting in the Hub (any non-deleted row for
 * today's week_start/day_index/post_type) is left untouched, so running this after the weekly
 * job — or twice in one day — never over-generates or duplicates.
 *
 * Output is always workflow_stage="hub" / status="draft" / content_lane="scheduled". Nothing
 * here ever sets status past draft or touches posted/posted_urls — approval and posting stay
 * 100% manual (standing rule 5, approve-only).
 */
export async function runDailyContentGeneration(args?: { date?: string }): Promise<DailyGenerationResult> {
  await hydratePlatformEnvFromDatabase();
  resetContentContextCache();

  const today = args?.date ? new Date(`${args.date}T00:00:00`) : new Date();
  const jsDay = today.getDay(); // 0=Sun .. 6=Sat
  const todayKey = formatCalendarDate(today);
  if (jsDay === 0 || jsDay === 6) {
    return { ran: false, reason: "Weekend — Match Fit's content calendar only runs Monday-Friday.", date: todayKey };
  }
  const dayIndex = jsDay - 1; // Mon=0 .. Fri=4
  const monday = getMondayOfWeek(today);
  const weekStart = formatCalendarDate(monday);
  const postDate = formatCalendarDate(addWeekdays(monday, dayIndex));

  const existing = await getExistingPostTypesForSlot(weekStart, dayIndex);
  const missingPostTypes = CONTENT_CALENDAR_POST_TYPES.filter((type) => !existing.has(type));

  if (!missingPostTypes.length) {
    return {
      ran: true,
      weekStart,
      postDate,
      dayIndex,
      targetGroup: "",
      createdPostTypes: [],
      skippedExistingPostTypes: [...CONTENT_CALENDAR_POST_TYPES],
      hashtagSnapshot: null,
    };
  }

  const dpmoPhase = await getMatchFitDpmoPhase();
  // Deliberately skip the weekly job's full social-profile scan here — it's the slowest step in
  // runWeeklyContentGeneration and this route already has a tighter maxDuration budget. Hashtag
  // research alone (still live web search, not a template) is enough for a single day's plan.
  const hashtags = await researchTrendingHashtags({ dpmoPhase });
  const targetGroup = normalizeTargetGroup(getContentCalendarRotation(dayIndex, 0).Static);
  // Same audience-correct CTA pattern as weekly-generation.ts's fallbackDayPlan.
  const cta = targetGroup === "Clients" ? "Drive to match-fit.net/client/sign-up" : "Drive to match-fit.net/trainer/sign-up";

  const customPrompt = [
    `Daily generation — ${CONTENT_CALENDAR_DAYS_LONG[dayIndex]} (${postDate}).`,
    `Target audience: ${targetGroup}.`,
    dpmoPhase ? `Current DPMO growth phase: ${dpmoPhase}.` : "",
    `Weave in currently-trending hashtags where natural: ${hashtags.hashtags.map((t) => `#${t}`).join(" ")}`,
    hashtags.trends.length ? `Trend notes: ${hashtags.trends.join(" | ")}` : "",
    `Generate only these post types for today: ${missingPostTypes.join(", ")}. Keep each distinct.`,
  ]
    .filter(Boolean)
    .join("\n");

  const { drafts } = await generateBulkContent({
    items: missingPostTypes.map((postType) => ({ postType, targetGroup })),
    scheduled: false,
    customPrompt,
    weekStart,
  });

  const createdPostTypes: ContentCalendarPostType[] = [];
  for (const postType of missingPostTypes) {
    const draft = drafts.find((d) => d.postType === postType) ?? drafts[missingPostTypes.indexOf(postType)];
    if (!draft) continue;

    const visualPrompt =
      postType === "Text"
        ? null
        : buildMediaGenerationPrompt({
            postType: postType as MediaPostType,
            visualPrompt: draft.visualPrompt,
            caption: draft.caption,
            targetGroup,
          });

    await createV2Draft({
      draft: { ...draft, postType, dayIndex, postDate, visualPrompt },
      weekStart,
      lane: "scheduled",
      adminId: DAILY_GENERATION_ADMIN_ID,
      cta,
      postDate,
      generateMedia: false,
      dpmoPhase,
      hashtagResearchSnapshot: hashtags as unknown as Record<string, unknown>,
    });
    createdPostTypes.push(postType);
  }

  return {
    ran: true,
    weekStart,
    postDate,
    dayIndex,
    targetGroup,
    createdPostTypes,
    skippedExistingPostTypes: [...existing],
    hashtagSnapshot: hashtags,
  };
}
