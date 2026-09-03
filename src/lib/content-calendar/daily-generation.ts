import "server-only";

import {
  CONTENT_CALENDAR_DAYS_LONG,
  CONTENT_CALENDAR_WEEKDAY_POST_TYPES,
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
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";

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
 * "Today" as a YYYY-MM-DD key in America/New_York, not server-local/UTC time. The cron this
 * feeds is documented (and named) as an ET-aligned 8am-ET job; using bare `new Date().getDay()`
 * would judge the weekday in whatever timezone the runner happens to be in, which can disagree
 * with the ET calendar date near midnight ET / around DST transitions. Only used for the no-args
 * (live cron) path — an explicit `date` override (manual backfill/testing) is taken literally.
 */
function todayKeyInEasternTime(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Daily Match Fit Content Hub generation — the "AXON agents do the research and push it to the
 * MF portal every day" pipeline JB asked for.
 *
 * This is a companion to the Monday `runWeeklyContentGeneration` (weekly-generation.ts), not a
 * replacement: the weekly job plans and drafts a full Mon-Fri week in one run (social scan +
 * hashtag research + a 5-day AI plan). This daily job runs every weekday morning, checks ONLY
 * today's Content Hub slot, and fills in whichever of TODAY's locked post types are still
 * missing — using fresh trending-hashtag research each time via callMatchFitAi (AXON local
 * Ollama first, then the free-tier fallbacks in docs/ai-vault.md; no static/repeated template).
 *
 * "Today's locked post types" is CONTENT_CALENDAR_WEEKDAY_POST_TYPES[dayIndex], the same
 * JB-locked per-weekday rotation weekly-generation.ts uses (Mon/Wed/Fri: Carousel + Video;
 * Tue/Thu: Static + Text) — NOT all four post types every day. Generating the other two types on
 * the wrong day would be exactly the bug fixed 2026-09-01 in the weekly job; this daily job must
 * never reintroduce it via a second code path.
 *
 * That makes this self-healing: if the weekly batch never ran, timed out partway through, or a
 * day's drafts got scrapped after the fact (the exact situation found live for week 2026-08-31 —
 * see the resolveUniqueDayIndex fix), today still gets a fresh set of drafts instead of staying
 * empty until next Monday.
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

  const todayKey = args?.date ?? todayKeyInEasternTime();
  const today = new Date(`${todayKey}T00:00:00`);
  const jsDay = today.getDay(); // 0=Sun .. 6=Sat
  if (jsDay === 0 || jsDay === 6) {
    return { ran: false, reason: "Weekend — Match Fit's content calendar only runs Monday-Friday.", date: todayKey };
  }
  const dayIndex = jsDay - 1; // Mon=0 .. Fri=4
  const monday = getMondayOfWeek(today);
  const weekStart = formatCalendarDate(monday);
  const postDate = formatCalendarDate(addWeekdays(monday, dayIndex));

  // Today's locked pair, not all four types — see the function doc comment above.
  const dayFormats = CONTENT_CALENDAR_WEEKDAY_POST_TYPES[dayIndex];

  const existing = await getExistingPostTypesForSlot(weekStart, dayIndex);
  const missingPostTypes = dayFormats.filter((type) => !existing.has(type));

  if (!missingPostTypes.length) {
    return {
      ran: true,
      weekStart,
      postDate,
      dayIndex,
      targetGroup: "",
      createdPostTypes: [],
      skippedExistingPostTypes: [...dayFormats],
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
    `${CONTENT_CALENDAR_DAYS_LONG[dayIndex]}'s locked post types are exactly: ${dayFormats.join(", ")}. Generate only these: ${missingPostTypes.join(", ")}. Keep each distinct. Do not generate any other post type today.`,
  ]
    .filter(Boolean)
    .join("\n");

  const { drafts } = await generateBulkContent({
    items: missingPostTypes.map((postType) => ({ postType, targetGroup })),
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

  const createdPostTypes: ContentCalendarPostType[] = [];
  for (const postType of missingPostTypes) {
    const draft = draftsByType.get(postType);
    if (!draft) {
      console.error(
        `[content-calendar daily generate] AI vault did not return a draft for ${postType} on ${postDate} — skipping rather than mislabeling another type's content.`,
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
      // createV2Draft's param type is the generic jsonb shape (Record<string, unknown> | null), not
      // the concrete HashtagResearchSnapshot `hashtags` already is — a single structural cast is
      // sufficient and verified to compile (no index-signature mismatch requiring an `unknown`
      // bridge); narrowed from the `as unknown as ...` double-cast used elsewhere in this codebase
      // (weekly-generation.ts), which isn't actually needed for this direction of cast.
      hashtagResearchSnapshot: hashtags as Record<string, unknown>,
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
    skippedExistingPostTypes: [...existing].filter((type) => dayFormats.includes(type)),
    hashtagSnapshot: hashtags,
  };
}
