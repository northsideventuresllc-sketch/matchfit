import { CONTENT_CALENDAR_TYPE_ICONS, type ContentCalendarPostType } from "@/lib/content-calendar/constants";
import type { ClientContentCalendarV2Post } from "@/lib/content-calendar/content-calendar-v2-store";

/**
 * Weekly generation runs from GitHub Actions cron `0 12 * * 1` (see
 * `.github/workflows/match-fit-content-calendar-weekly-generate.yml`) — 12:00 UTC every Monday,
 * which is 8:00 AM ET while EDT is in effect (7:00 AM during EST). Surfaced in the Content Hub
 * banner so the operator sees the actual configured generation time rather than a guess.
 */
export const WEEKLY_GENERATION_TIME_LABEL = "Monday mornings at 8:00 AM ET";

/** Locked daily post order inside a day container. */
export const POST_TYPE_ORDER: ContentCalendarPostType[] = ["Static", "Carousel", "Text", "Video"];

export function postTypeIcon(postType: ContentCalendarPostType): string {
  return CONTENT_CALENDAR_TYPE_ICONS[postType] ?? "";
}

/**
 * Default per-platform variations offered per post type in Publishing (JB spec, verbatim):
 * Text → Threads + Facebook. Static → Instagram / Threads / Facebook (via IG upload).
 * Carousel → Instagram / Threads / Facebook (via IG upload) + TikTok.
 * Video → TikTok / Instagram / Threads / Facebook Reels (via IG upload).
 */
export const PUBLISHING_PLATFORM_VARIATIONS: Record<ContentCalendarPostType, string[]> = {
  Text: ["Threads", "Facebook"],
  Static: ["Instagram", "Threads", "Facebook"],
  Carousel: ["Instagram", "Threads", "Facebook", "TikTok"],
  Video: ["TikTok", "Instagram", "Threads", "Facebook Reels"],
};

/** Resolve the default platform checklist for a post — spec variations first, else stored platforms. */
export function defaultPlatformsForPost(post: ClientContentCalendarV2Post): string[] {
  const variations = PUBLISHING_PLATFORM_VARIATIONS[post.postType];
  if (variations?.length) return variations;
  return post.platformList;
}

/**
 * Best-effort interactive-preview target for a platform. There is no public "render my exact
 * caption" preview API, so we link out to the platform's composer / home in a new tab as an
 * approximation the operator can paste into. TikTok video routes to TikTok Studio (scheduled
 * posting works there under 1K followers; the app does not offer it).
 */
export function platformPreviewUrl(platform: string): string {
  const key = platform.toLowerCase();
  if (key.includes("tiktok")) return "https://www.tiktok.com/tiktokstudio/upload";
  if (key.includes("instagram")) return "https://www.instagram.com/";
  if (key.includes("thread")) return "https://www.threads.net/";
  if (key.includes("reel")) return "https://www.facebook.com/reels/create";
  if (key.includes("facebook")) return "https://www.facebook.com/";
  return "https://match-fit.net";
}

function parseCalendarDate(postDate: string): Date | null {
  if (!postDate) return null;
  const d = new Date(`${postDate}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Monday · Jul 27" style label from a YYYY-MM-DD post date. */
export function dayLabelFromDate(postDate: string): string {
  const d = parseCalendarDate(postDate);
  if (!d) return "No date";
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const md = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${weekday} · ${md}`;
}

export type HubDayGroup = {
  date: string;
  label: string;
  posts: ClientContentCalendarV2Post[];
  scheduled: ClientContentCalendarV2Post[];
  impromptu: ClientContentCalendarV2Post[];
  approved: boolean;
};

function orderPosts(posts: ClientContentCalendarV2Post[]): ClientContentCalendarV2Post[] {
  return [...posts].sort((a, b) => {
    const ai = POST_TYPE_ORDER.indexOf(a.postType);
    const bi = POST_TYPE_ORDER.indexOf(b.postType);
    if (ai !== bi) return ai - bi;
    return a.id.localeCompare(b.id);
  });
}

/** A day is "approved" once every post it contains carries an approvedAt timestamp. */
export function isDayApproved(posts: ClientContentCalendarV2Post[]): boolean {
  return posts.length > 0 && posts.every((p) => Boolean(p.approvedAt));
}

/**
 * Groups Content Hub posts into day-level containers (one window per calendar date holding all of
 * that day's posts), keeping impromptu-lane posts separated within their date. Posts with no date
 * (dateless impromptu drafts) are returned separately since the day-approve / fire-cowork routes
 * are keyed by date and cannot act on them.
 */
export function groupHubPosts(posts: ClientContentCalendarV2Post[]): {
  days: HubDayGroup[];
  undated: ClientContentCalendarV2Post[];
} {
  const byDate = new Map<string, ClientContentCalendarV2Post[]>();
  const undated: ClientContentCalendarV2Post[] = [];

  for (const post of posts) {
    if (!post.postDate) {
      undated.push(post);
      continue;
    }
    const bucket = byDate.get(post.postDate) ?? [];
    bucket.push(post);
    byDate.set(post.postDate, bucket);
  }

  const days: HubDayGroup[] = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, datePosts]) => {
      const ordered = orderPosts(datePosts);
      return {
        date,
        label: dayLabelFromDate(date),
        posts: ordered,
        scheduled: ordered.filter((p) => p.contentLane !== "impromptu"),
        impromptu: ordered.filter((p) => p.contentLane === "impromptu"),
        approved: isDayApproved(ordered),
      };
    });

  return { days, undated: orderPosts(undated) };
}

/**
 * Human retention countdown from an ISO purge timestamp. Returns e.g. "1d 4h left", "3h 12m left",
 * "12m left", or "purging soon" when past due. `nowMs` is injectable for tests.
 */
export function formatRetentionCountdown(purgeAfterAt: string | null, nowMs: number = Date.now()): string {
  if (!purgeAfterAt) return "No retention window set";
  const target = new Date(purgeAfterAt).getTime();
  if (Number.isNaN(target)) return "No retention window set";
  const diff = target - nowMs;
  if (diff <= 0) return "Purging soon";
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

export type PublishingFilters = {
  fromDate: string;
  toDate: string;
  statuses: ("unposted" | "posted")[];
  platforms: string[];
  postTypes: ContentCalendarPostType[];
};

export const EMPTY_PUBLISHING_FILTERS: PublishingFilters = {
  fromDate: "",
  toDate: "",
  statuses: [],
  platforms: [],
  postTypes: [],
};

/** Multi-select publishing filter — empty facets match everything. */
export function matchesPublishingFilters(post: ClientContentCalendarV2Post, filters: PublishingFilters): boolean {
  if (filters.fromDate && (!post.postDate || post.postDate < filters.fromDate)) return false;
  if (filters.toDate && (!post.postDate || post.postDate > filters.toDate)) return false;

  if (filters.statuses.length) {
    const status: "unposted" | "posted" = post.posted ? "posted" : "unposted";
    if (!filters.statuses.includes(status)) return false;
  }

  if (filters.postTypes.length && !filters.postTypes.includes(post.postType)) return false;

  if (filters.platforms.length) {
    const postPlatforms = defaultPlatformsForPost(post);
    const hit = filters.platforms.some((wanted) =>
      postPlatforms.some((p) => p.toLowerCase().includes(wanted.toLowerCase())),
    );
    if (!hit) return false;
  }

  return true;
}

/** All platforms present across the Publishing set (for the platform filter chips). */
export function collectPublishingPlatforms(posts: ClientContentCalendarV2Post[]): string[] {
  const set = new Set<string>();
  for (const post of posts) for (const p of defaultPlatformsForPost(post)) set.add(p);
  return [...set].sort();
}
