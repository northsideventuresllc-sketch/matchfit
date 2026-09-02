import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateNiBrainClient, mockFireAxonPostingConfirmation, mockHasDayScheduledEmailBeenSent } = vi.hoisted(
  () => ({
    mockCreateNiBrainClient: vi.fn(),
    mockFireAxonPostingConfirmation: vi.fn(),
    mockHasDayScheduledEmailBeenSent: vi.fn(),
  }),
);

vi.mock("@/lib/ni-brain-client", () => ({
  createNiBrainClient: mockCreateNiBrainClient,
  recordDayApprovalMemo: vi.fn().mockResolvedValue({ id: "memo_1" }),
  cancelDayApprovalMemo: vi.fn(),
  // Short-circuits notifyDayScheduled's email send for every test in this file — none of them are
  // testing the Resend email path, and manuallyGenerateDayMedia below does call it in passing.
  hasDayScheduledEmailBeenSent: mockHasDayScheduledEmailBeenSent,
}));

vi.mock("@/lib/content-calendar/axon-notify", () => ({
  fireAxonPostingConfirmation: mockFireAxonPostingConfirmation,
}));

import {
  approvePublishingPostsForPosting,
  completeGenerateMediaJob,
  completePostBatchJob,
  fireCoworkForDay,
  fireCoworkForPost,
  manuallyGenerateDayMedia,
} from "@/lib/content-calendar/content-calendar-cowork-orchestration";

beforeEach(() => {
  vi.clearAllMocks();
  mockFireAxonPostingConfirmation.mockResolvedValue(undefined);
  mockHasDayScheduledEmailBeenSent.mockResolvedValue(true);
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

/** Minimal chainable fake for a single-post read/update/reload cycle, shared by fireCoworkForPost's two tests. */
function buildSinglePostClient(initialPost: Record<string, unknown>) {
  const post: Record<string, unknown> = { ...initialPost };
  const updates: Record<string, unknown>[] = [];
  const jobInserts: Record<string, unknown>[] = [];
  const miniJobInserts: Record<string, unknown>[] = [];

  const postsBuilder: Record<string, unknown> = {};
  Object.assign(postsBuilder, {
    select: () => postsBuilder,
    eq: () => postsBuilder,
    maybeSingle: () => Promise.resolve({ data: { ...post }, error: null }),
    single: () => Promise.resolve({ data: { ...post }, error: null }),
    update: (patch: Record<string, unknown>) => {
      updates.push(patch);
      Object.assign(post, patch);
      return { eq: () => Promise.resolve({ error: null }) };
    },
  });

  const jobsBuilder = {
    insert: (row: Record<string, unknown>) => {
      jobInserts.push(row);
      return { select: () => ({ single: () => Promise.resolve({ data: { id: "job_1", ...row }, error: null }) }) };
    },
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
  };

  const miniJobsBuilder = {
    insert: (row: Record<string, unknown>) => {
      miniJobInserts.push(row);
      return Promise.resolve({ error: null });
    },
  };

  const client = {
    from: (table: string) => {
      if (table === "match_fit_content_cowork_jobs") return jobsBuilder;
      if (table === "nvg_mini_jobs") return miniJobsBuilder;
      return postsBuilder;
    },
  };

  return { client, updates, jobInserts, miniJobInserts };
}

const baseMediaPost = {
  id: "post_1",
  post_type: "Static",
  platforms: "Instagram, Threads",
  target_group: "Join the Team",
  caption: "Base caption",
  visual_prompt: "A trainer coaching a client",
  post_date: "2026-08-31",
};

describe("fireCoworkForPost", () => {
  it("starting from hub: creates a single-post generate_media job and lands the post in pending", async () => {
    const { client, updates, jobInserts, miniJobInserts } = buildSinglePostClient({
      ...baseMediaPost,
      workflow_stage: "hub",
    });
    mockCreateNiBrainClient.mockReturnValue(client);

    const { job, post } = await fireCoworkForPost("post_1");

    expect(job.id).toBe("job_1");
    expect(post.workflow_stage).toBe("pending");
    expect(updates[0]).toMatchObject({ workflow_stage: "pending", status: "pending", media_status: "generating" });
    expect(updates[0].media_generation_started_at).toBeTruthy();
    expect(jobInserts[0]).toMatchObject({ job_type: "generate_media" });
    // The real agent fires too — a shell job on the mini running the browser/Gemini-Pro
    // automation for this exact post, not just the (broken) REST-API cowork job above.
    expect(miniJobInserts).toHaveLength(1);
    expect(miniJobInserts[0]).toMatchObject({ kind: "shell" });
    expect((miniJobInserts[0].payload as { cmd: string }).cmd).toContain("--ids=post_1");
    expect((miniJobInserts[0].payload as { cmd: string }).cmd).toContain("gemini-media-automation.mjs");
  });

  it("starting from publishing (Regenerate): still lands the post in pending, existing media untouched by the patch", async () => {
    const { client, updates } = buildSinglePostClient({
      ...baseMediaPost,
      workflow_stage: "publishing",
      media_urls: ["https://cdn.test/existing.png"],
    });
    mockCreateNiBrainClient.mockReturnValue(client);

    const { post } = await fireCoworkForPost("post_1", { feedback: "Brighter lighting." });

    expect(post.workflow_stage).toBe("pending");
    // Regenerate's stage-move patch never touches media_url(s) — existing media stays attached
    // until the job's callback (completeGenerateMediaJob) actually lands.
    expect(updates[0]).not.toHaveProperty("media_urls");
    expect(updates[0].last_generation_prompt).toContain("Brighter lighting.");
  });
});

describe("fireCoworkForDay reads from pending", () => {
  it("filters on workflow_stage 'pending' (not hub+approved) and creates one generate_media job", async () => {
    const pendingPosts = [{ ...baseMediaPost, id: "post_1", workflow_stage: "pending" }];
    const capturedFilters: Record<string, unknown> = {};
    const updates: Record<string, unknown>[] = [];

    const postsBuilder: Record<string, unknown> = {};
    Object.assign(postsBuilder, {
      select: () => postsBuilder,
      eq: (col: string, val: unknown) => {
        capturedFilters[col] = val;
        return postsBuilder;
      },
      is: () => Promise.resolve({ data: pendingPosts, error: null }),
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        return { eq: () => Promise.resolve({ error: null }) };
      },
    });
    const jobsBuilder = {
      insert: (row: Record<string, unknown>) => ({
        select: () => ({ single: () => Promise.resolve({ data: { id: "job_1", ...row }, error: null }) }),
      }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    };
    const miniJobInserts: Record<string, unknown>[] = [];
    const miniJobsBuilder = {
      insert: (row: Record<string, unknown>) => {
        miniJobInserts.push(row);
        return Promise.resolve({ error: null });
      },
    };
    mockCreateNiBrainClient.mockReturnValue({
      from: (table: string) => {
        if (table === "match_fit_content_cowork_jobs") return jobsBuilder;
        if (table === "nvg_mini_jobs") return miniJobsBuilder;
        return postsBuilder;
      },
    });

    const { job, mediaPostCount } = await fireCoworkForDay("2026-08-31");

    expect(capturedFilters.workflow_stage).toBe("pending");
    expect(capturedFilters.post_date).toBe("2026-08-31");
    expect(mediaPostCount).toBe(1);
    expect(job.id).toBe("job_1");
    // The real agent fires for every media post staged that day, not just the REST-API job.
    expect(miniJobInserts).toHaveLength(1);
    expect((miniJobInserts[0].payload as { cmd: string }).cmd).toContain("--ids=post_1");
  });
});

describe("manuallyGenerateDayMedia", () => {
  it("moves every hub post for the date straight to workflow_stage publishing, bypassing pending entirely", async () => {
    const hubPosts = [
      { id: "post_static", post_type: "Static", target_group: "Join the Team" },
      { id: "post_text", post_type: "Text", target_group: "Join the Team" },
    ];
    const patches: { ids: string[]; patch: Record<string, unknown> }[] = [];

    const postsBuilder: Record<string, unknown> = {};
    Object.assign(postsBuilder, {
      select: () => postsBuilder,
      eq: () => postsBuilder,
      is: () => Promise.resolve({ data: hubPosts, error: null }),
      update: (patch: Record<string, unknown>) => ({
        in: (_col: string, ids: string[]) => {
          patches.push({ ids, patch });
          return Promise.resolve({ error: null });
        },
      }),
    });
    mockCreateNiBrainClient.mockReturnValue({ from: () => postsBuilder });

    const { moved } = await manuallyGenerateDayMedia("2026-08-31");

    expect(moved).toBe(2);
    // Both the static (media) and text post are in the same single "allIds" patch, straight to
    // publishing — never staged through "pending" at all.
    expect(patches).toHaveLength(1);
    expect(patches[0].ids.sort()).toEqual(["post_static", "post_text"]);
    expect(patches[0].patch).toMatchObject({ workflow_stage: "publishing", status: "publishing" });
  });
});

describe("completeGenerateMediaJob stage guard", () => {
  it("does not resurrect a post into publishing if it moved off pending before the callback landed", async () => {
    // post_still_pending is genuinely still in "pending" when the callback lands; post_moved_away
    // stands in for one JB hit Stop on (or a day-level bypass already moved) — its workflow_stage
    // is no longer "pending", so the UPDATE's own .eq("workflow_stage", "pending") matches zero rows.
    const stillPending = new Set(["post_still_pending"]);
    const updateAttempts: Record<string, unknown>[] = [];

    const postsBuilder: Record<string, unknown> = {};
    Object.assign(postsBuilder, {
      update: (patch: Record<string, unknown>) => {
        const filters: Record<string, unknown> = {};
        const chain: Record<string, unknown> = {};
        Object.assign(chain, {
          eq: (col: string, val: unknown) => {
            filters[col] = val;
            return chain;
          },
          select: () => {
            updateAttempts.push({ ...filters });
            const matched = filters.workflow_stage === "pending" && stillPending.has(filters.id as string);
            return Promise.resolve({ data: matched ? [{ id: filters.id }] : [], error: null });
          },
        });
        void patch;
        return chain;
      },
    });
    const jobsBuilder = { update: () => ({ eq: () => Promise.resolve({ error: null }) }) };
    mockCreateNiBrainClient.mockReturnValue({
      from: (table: string) => (table === "match_fit_content_cowork_jobs" ? jobsBuilder : postsBuilder),
    });

    const { updated } = await completeGenerateMediaJob({
      jobId: "job_1",
      mediaUrls: {
        post_still_pending: ["https://cdn.test/a.png"],
        post_moved_away: ["https://cdn.test/b.png"],
      },
    });

    // Only the post that was genuinely still pending got counted — the moved-away post's UPDATE
    // matched zero rows and was silently skipped, not resurrected into publishing.
    expect(updated).toBe(1);
    expect(updateAttempts).toHaveLength(2);
    expect(updateAttempts.every((f) => f.workflow_stage === "pending")).toBe(true);
  });
});
