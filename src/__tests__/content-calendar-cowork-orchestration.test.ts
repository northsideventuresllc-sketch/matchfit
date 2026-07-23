import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateNiBrainClient, mockFireAxonPostingConfirmation } = vi.hoisted(() => ({
  mockCreateNiBrainClient: vi.fn(),
  mockFireAxonPostingConfirmation: vi.fn(),
}));

vi.mock("@/lib/ni-brain-client", () => ({
  createNiBrainClient: mockCreateNiBrainClient,
  recordDayApprovalMemo: vi.fn(),
  cancelDayApprovalMemo: vi.fn(),
}));

vi.mock("@/lib/content-calendar/axon-notify", () => ({
  fireAxonPostingConfirmation: mockFireAxonPostingConfirmation,
}));

import {
  approvePublishingPostsForPosting,
  completePostBatchJob,
} from "@/lib/content-calendar/content-calendar-cowork-orchestration";

beforeEach(() => {
  vi.clearAllMocks();
  mockFireAxonPostingConfirmation.mockResolvedValue(undefined);
});

describe("completePostBatchJob", () => {
  it("archives each posted post — workflow_stage archived + archived_at + posted flags", async () => {
    let capturedPatch: Record<string, unknown> | null = null;

    mockCreateNiBrainClient.mockReturnValue({
      from: (table: string) => {
        if (table === "match_fit_content_calendar_settings") {
          return {
            select: () => ({
              order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
            }),
          };
        }
        if (table === "match_fit_content_cowork_jobs") {
          return { update: () => ({ eq: () => Promise.resolve({ error: null }) }) };
        }
        // match_fit_content_calendar_posts
        return {
          update: (patch: Record<string, unknown>) => {
            capturedPatch = patch;
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
      },
    });

    const { updated } = await completePostBatchJob({
      jobId: "job_1",
      postedUrls: [{ postId: "post_1", platform: "Instagram", url: "https://ig.test/p/1" }],
    });

    expect(updated).toBe(1);
    expect(capturedPatch).toMatchObject({
      posted: true,
      status: "posted",
      workflow_stage: "archived",
      archive_type: "posted",
    });
    // The dead-row bug: without these two the post never reaches the Archives query.
    expect((capturedPatch as Record<string, unknown>).workflow_stage).toBe("archived");
    expect((capturedPatch as Record<string, unknown>).archived_at).toBeTruthy();
    expect((capturedPatch as Record<string, unknown>).purge_after_at).toBeTruthy();
    expect(mockFireAxonPostingConfirmation).toHaveBeenCalledTimes(1);
  });
});

type PostRow = {
  id: string;
  platforms: string;
  post_type: string;
  post_date: string;
  target_group: string;
  caption: string;
  hashtags: string[];
  media_urls: string[];
  platform_captions: Record<string, string> | null;
  platform_hashtags: Record<string, string[]> | null;
};

function buildApproveClient(rows: PostRow[]) {
  const captured: { insert: Record<string, unknown> | null } = { insert: null };
  const postsBuilder = {
    select: () => postsBuilder,
    eq: () => postsBuilder,
    is: () => postsBuilder,
    in: () => postsBuilder,
    update: () => ({ in: () => Promise.resolve({ error: null }) }),
    then: (resolve: (v: { data: PostRow[]; error: null }) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve),
  };
  const jobsBuilder = {
    insert: (row: Record<string, unknown>) => {
      captured.insert = row;
      return { select: () => ({ single: () => Promise.resolve({ data: { id: "job_1", ...row }, error: null }) }) };
    },
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
  };
  const client = {
    from: (table: string) => (table === "match_fit_content_cowork_jobs" ? jobsBuilder : postsBuilder),
  };
  return { client, captured };
}

const baseRow: PostRow = {
  id: "post_1",
  platforms: "Instagram, Threads, Facebook, TikTok",
  post_type: "Carousel",
  post_date: "2026-07-27",
  target_group: "Join the Team",
  caption: "Base caption",
  hashtags: ["#matchfit"],
  media_urls: ["https://cdn.test/a.png"],
  platform_captions: null,
  platform_hashtags: null,
};

describe("approvePublishingPostsForPosting platformOverrides", () => {
  it("uses the override platform list instead of the stored platforms", async () => {
    const { client, captured } = buildApproveClient([baseRow]);
    mockCreateNiBrainClient.mockReturnValue(client);

    const { job } = await approvePublishingPostsForPosting({
      postIds: ["post_1"],
      platformOverrides: { post_1: ["Instagram", "Threads"] },
    });

    const brief = captured.insert?.brief as { posts: { platforms: { platform: string }[] }[] };
    const platforms = brief.posts[0].platforms.map((p) => p.platform);
    expect(platforms).toEqual(["Instagram", "Threads"]);
    expect(captured.insert?.platform_targets).toEqual(["Instagram", "Threads"]);
    // Job returned round-trips the same override in its brief.
    const jobBrief = job.brief as { posts: { platforms: { platform: string }[] }[] };
    expect(jobBrief.posts[0].platforms.map((p) => p.platform)).toEqual(["Instagram", "Threads"]);
  });

  it("falls back to the post's stored platforms when no override entry is present", async () => {
    const { client, captured } = buildApproveClient([baseRow]);
    mockCreateNiBrainClient.mockReturnValue(client);

    await approvePublishingPostsForPosting({ postIds: ["post_1"] });

    const brief = captured.insert?.brief as { posts: { platforms: { platform: string }[] }[] };
    const platforms = brief.posts[0].platforms.map((p) => p.platform);
    expect(platforms).toEqual(["Instagram", "Threads", "Facebook", "TikTok"]);
    expect(captured.insert?.platform_targets).toEqual(["Instagram", "Threads", "Facebook", "TikTok"]);
  });

  it("only overrides the posts named in platformOverrides, leaving others on their stored platforms", async () => {
    const secondRow: PostRow = { ...baseRow, id: "post_2", platforms: "Threads, Facebook" };
    const { client, captured } = buildApproveClient([baseRow, secondRow]);
    mockCreateNiBrainClient.mockReturnValue(client);

    await approvePublishingPostsForPosting({
      postIds: ["post_1", "post_2"],
      platformOverrides: { post_1: ["Instagram"] },
    });

    const brief = captured.insert?.brief as { posts: { postId: string; platforms: { platform: string }[] }[] };
    const byId = Object.fromEntries(brief.posts.map((p) => [p.postId, p.platforms.map((x) => x.platform)]));
    expect(byId.post_1).toEqual(["Instagram"]);
    expect(byId.post_2).toEqual(["Threads", "Facebook"]);
  });
});
