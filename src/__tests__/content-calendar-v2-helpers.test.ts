import { describe, expect, it } from "vitest";
import type { ClientContentCalendarV2Post } from "@/lib/content-calendar/content-calendar-v2-store";
import {
  collectPublishingPlatforms,
  defaultPlatformsForPost,
  EMPTY_PUBLISHING_FILTERS,
  formatRetentionCountdown,
  groupHubPosts,
  isDayApproved,
  matchesPublishingFilters,
  platformPreviewUrl,
  PUBLISHING_PLATFORM_VARIATIONS,
} from "@/app/admin/content-calendar/v2/components/helpers";

function post(overrides: Partial<ClientContentCalendarV2Post> = {}): ClientContentCalendarV2Post {
  return {
    id: Math.random().toString(36).slice(2),
    weekStart: "2026-07-27",
    postDate: "2026-07-27",
    dayIndex: 0,
    postType: "Static",
    targetGroup: "Clients",
    platforms: "Instagram, Threads, Facebook",
    platformList: ["Instagram", "Threads", "Facebook"],
    status: "draft",
    caption: "Caption",
    visualPrompt: "Visual",
    hashtags: ["MatchFit"],
    mediaUrl: null,
    mediaUrls: [],
    mediaStatus: "none",
    posted: false,
    postedAt: null,
    approvedAt: null,
    scheduledAt: null,
    savedToHubAt: null,
    isScheduled: false,
    theme: "Theme",
    cta: "CTA",
    contentLane: "scheduled",
    workflowStage: "hub",
    platformCaptions: {},
    platformHashtags: {},
    optimizeStatus: "idle",
    optimizeError: null,
    optimizeStartedAt: null,
    dpmoPhase: null,
    dpmoRationale: null,
    socialScanSnapshotId: null,
    hashtagResearchSnapshot: null,
    archivedAt: null,
    archiveType: null,
    scrapReason: null,
    postedUrls: {},
    purgeAfterAt: null,
    bulkSessionId: null,
    deletedAt: null,
    ...overrides,
  } as ClientContentCalendarV2Post;
}

describe("content calendar v2 helpers", () => {
  it("defines the JB-spec platform variations per post type", () => {
    expect(PUBLISHING_PLATFORM_VARIATIONS.Text).toEqual(["Threads", "Facebook"]);
    expect(PUBLISHING_PLATFORM_VARIATIONS.Video).toContain("TikTok");
    expect(PUBLISHING_PLATFORM_VARIATIONS.Video).toContain("Facebook Reels");
    expect(defaultPlatformsForPost(post({ postType: "Carousel" }))).toContain("TikTok");
  });

  it("routes TikTok previews to TikTok Studio and others to their composer", () => {
    expect(platformPreviewUrl("TikTok")).toContain("tiktokstudio");
    expect(platformPreviewUrl("Instagram")).toContain("instagram.com");
    expect(platformPreviewUrl("Facebook Reels")).toContain("reels");
    expect(platformPreviewUrl("Threads")).toContain("threads.net");
  });

  it("groups hub posts into day containers and separates dateless impromptu drafts", () => {
    const posts = [
      post({ id: "a", postDate: "2026-07-27", postType: "Static" }),
      post({ id: "b", postDate: "2026-07-27", postType: "Video" }),
      post({ id: "c", postDate: "2026-07-28", postType: "Text" }),
      post({ id: "d", postDate: "2026-07-27", postType: "Carousel", contentLane: "impromptu" }),
      post({ id: "e", postDate: "", contentLane: "impromptu", postType: "Text" }),
    ];
    const { days, undated } = groupHubPosts(posts);
    expect(days).toHaveLength(2);
    expect(days[0].date).toBe("2026-07-27");
    expect(days[0].scheduled).toHaveLength(2);
    expect(days[0].impromptu).toHaveLength(1);
    expect(days[0].posts[0].postType).toBe("Static"); // ordered
    expect(undated).toHaveLength(1);
    expect(undated[0].id).toBe("e");
  });

  it("marks a day approved only when every post is approved", () => {
    expect(isDayApproved([post({ approvedAt: null }), post({ approvedAt: "x" })])).toBe(false);
    expect(isDayApproved([post({ approvedAt: "x" }), post({ approvedAt: "y" })])).toBe(true);
    expect(isDayApproved([])).toBe(false);
  });

  it("formats retention countdowns", () => {
    const now = Date.parse("2026-07-27T00:00:00Z");
    expect(formatRetentionCountdown(null, now)).toContain("No retention");
    expect(formatRetentionCountdown("2026-07-28T04:00:00Z", now)).toBe("1d 4h left");
    expect(formatRetentionCountdown("2026-07-27T03:12:00Z", now)).toBe("3h 12m left");
    expect(formatRetentionCountdown("2026-07-27T00:12:00Z", now)).toBe("12m left");
    expect(formatRetentionCountdown("2026-07-26T00:00:00Z", now)).toBe("Purging soon");
  });

  it("applies multi-select publishing filters (empty facets match all)", () => {
    const p = post({ postDate: "2026-07-27", postType: "Video", posted: false });
    expect(matchesPublishingFilters(p, EMPTY_PUBLISHING_FILTERS)).toBe(true);
    expect(matchesPublishingFilters(p, { ...EMPTY_PUBLISHING_FILTERS, statuses: ["posted"] })).toBe(false);
    expect(matchesPublishingFilters(p, { ...EMPTY_PUBLISHING_FILTERS, statuses: ["unposted"] })).toBe(true);
    expect(matchesPublishingFilters(p, { ...EMPTY_PUBLISHING_FILTERS, postTypes: ["Static"] })).toBe(false);
    expect(matchesPublishingFilters(p, { ...EMPTY_PUBLISHING_FILTERS, fromDate: "2026-07-28" })).toBe(false);
    expect(matchesPublishingFilters(p, { ...EMPTY_PUBLISHING_FILTERS, platforms: ["TikTok"] })).toBe(true);
    expect(matchesPublishingFilters(p, { ...EMPTY_PUBLISHING_FILTERS, platforms: ["LinkedIn"] })).toBe(false);
  });

  it("collects the distinct platform set across publishing posts", () => {
    const platforms = collectPublishingPlatforms([post({ postType: "Text" }), post({ postType: "Video" })]);
    expect(platforms).toContain("Threads");
    expect(platforms).toContain("TikTok");
  });
});
