import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateNiBrainClient,
  mockFireAxonPostingConfirmation,
  mockSendResendEmail,
  mockRecordDayApprovalMemo,
  mockCancelDayApprovalMemo,
  mockHasDayScheduledEmailBeenSent,
  mockRecordDayScheduledEmailSent,
  mockHasDayAllPostedEmailBeenSent,
  mockRecordDayAllPostedEmailSent,
} = vi.hoisted(() => ({
  mockCreateNiBrainClient: vi.fn(),
  mockFireAxonPostingConfirmation: vi.fn(),
  mockSendResendEmail: vi.fn(),
  mockRecordDayApprovalMemo: vi.fn(),
  mockCancelDayApprovalMemo: vi.fn(),
  mockHasDayScheduledEmailBeenSent: vi.fn(),
  mockRecordDayScheduledEmailSent: vi.fn(),
  mockHasDayAllPostedEmailBeenSent: vi.fn(),
  mockRecordDayAllPostedEmailSent: vi.fn(),
}));

vi.mock("@/lib/ni-brain-client", () => ({
  createNiBrainClient: mockCreateNiBrainClient,
  recordDayApprovalMemo: mockRecordDayApprovalMemo,
  cancelDayApprovalMemo: mockCancelDayApprovalMemo,
  hasDayScheduledEmailBeenSent: mockHasDayScheduledEmailBeenSent,
  recordDayScheduledEmailSent: mockRecordDayScheduledEmailSent,
  hasDayAllPostedEmailBeenSent: mockHasDayAllPostedEmailBeenSent,
  recordDayAllPostedEmailSent: mockRecordDayAllPostedEmailSent,
}));

vi.mock("@/lib/content-calendar/axon-notify", () => ({
  fireAxonPostingConfirmation: mockFireAxonPostingConfirmation,
}));

vi.mock("@/lib/resend-client", () => ({
  sendResendEmail: mockSendResendEmail,
  MATCH_FIT_NOREPLY_FROM: "Match Fit <noreply@match-fit.net>",
}));

import {
  approvePublishingPostsForPosting,
  completePostBatchJob,
  fireCoworkForPost,
  manuallyGenerateDayMedia,
  maybeNotifyDayFullyPosted,
  notifyDayScheduled,
} from "@/lib/content-calendar/content-calendar-cowork-orchestration";

beforeEach(() => {
  vi.clearAllMocks();
  mockFireAxonPostingConfirmation.mockResolvedValue(undefined);
  mockRecordDayApprovalMemo.mockResolvedValue({ id: "memo_1" });
  mockCancelDayApprovalMemo.mockResolvedValue(0);
  mockSendResendEmail.mockResolvedValue("email_1");
  mockHasDayScheduledEmailBeenSent.mockResolvedValue(false);
  mockRecordDayScheduledEmailSent.mockResolvedValue(undefined);
  mockHasDayAllPostedEmailBeenSent.mockResolvedValue(false);
  mockRecordDayAllPostedEmailSent.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Generic stateful fake for the NI Brain posts + cowork-jobs tables. Several
// functions under test do a read → mutate(→ read again) sequence within one
// call, and separate client.from(table) calls must all see the same mutated
// rows — so this closes over one shared `rows` array by reference.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

interface RowQuery {
  select: (cols?: string) => RowQuery;
  eq: (col: string, val: unknown) => RowQuery;
  is: (col: string, val: unknown) => RowQuery;
  in: (col: string, vals: unknown[]) => RowQuery;
  update: (patch: Record<string, unknown>) => RowQuery;
  single: () => Promise<{ data: Row | null; error: null }>;
  maybeSingle: () => Promise<{ data: Row | null; error: null }>;
  then: (resolve: (v: { data: Row[]; error: null }) => unknown) => unknown;
}

function makeRowsBuilder(rows: Row[]): RowQuery {
  const build = (
    filters: ((r: Row) => boolean)[],
    mode: "select" | "update",
    patch: Record<string, unknown> | null,
  ): RowQuery => {
    const matched = (): Row[] => {
      const rowsMatched = rows.filter((r) => filters.every((f) => f(r)));
      if (mode === "update" && patch) rowsMatched.forEach((r) => Object.assign(r, patch));
      return rowsMatched;
    };
    return {
      select: () => build(filters, mode, patch),
      eq: (col, val) => build([...filters, (r) => r[col] === val], mode, patch),
      is: (col, val) => build([...filters, (r) => r[col] === val], mode, patch),
      in: (col, vals) => build([...filters, (r) => vals.includes(r[col])], mode, patch),
      update: (p) => build(filters, "update", p),
      single: () => {
        const m = matched();
        return Promise.resolve({ data: m[0] ? { ...m[0] } : null, error: null });
      },
      maybeSingle: () => {
        const m = matched();
        return Promise.resolve({ data: m[0] ? { ...m[0] } : null, error: null });
      },
      then: (resolve: (v: { data: Row[]; error: null }) => unknown) =>
        Promise.resolve({ data: matched().map((r) => ({ ...r })), error: null }).then(resolve),
    };
  };
  return build([], "select", null);
}

type CaptureBucket = {
  jobInserts: Record<string, unknown>[];
  jobBriefUpdates: Record<string, unknown>[];
  jobStatusUpdates: Record<string, unknown>[];
};

function buildOrchestrationClient(postsRows: Row[]) {
  const captured: CaptureBucket = { jobInserts: [], jobBriefUpdates: [], jobStatusUpdates: [] };
  let jobCounter = 0;
  const jobsBuilder = {
    insert: (row: Record<string, unknown>) => {
      captured.jobInserts.push(row);
      jobCounter += 1;
      const id = `job_${jobCounter}`;
      return { select: () => ({ single: () => Promise.resolve({ data: { id, ...row }, error: null }) }) };
    },
    update: (patch: Record<string, unknown>) => {
      if ("brief" in patch) captured.jobBriefUpdates.push(patch);
      else captured.jobStatusUpdates.push(patch);
      return { eq: () => Promise.resolve({ error: null }) };
    },
  };
  const settingsBuilder = {
    select: () => ({
      order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
    }),
  };
  const client = {
    from: (table: string) => {
      if (table === "match_fit_content_cowork_jobs") return jobsBuilder;
      if (table === "match_fit_content_calendar_settings") return settingsBuilder;
      return makeRowsBuilder(postsRows);
    },
  };
  return { client, captured };
}

function makePost(overrides: Record<string, unknown> = {}): Row {
  return {
    id: "post_1",
    post_date: "2026-07-27",
    workflow_stage: "hub",
    deleted_at: null,
    post_type: "Static",
    target_group: "Join the Team",
    dpmo_phase: null,
    platforms: "Instagram, Threads",
    caption: "Base caption",
    visual_prompt: null,
    archive_type: null,
    posted_urls: null,
    approved_at: null,
    status: "draft",
    ...overrides,
  };
}

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

  it("sends the fully-posted email when this batch posts the last outstanding post for a date", async () => {
    const rows = [makePost({ id: "post_1", workflow_stage: "publishing", post_type: "Static" })];
    mockCreateNiBrainClient.mockReturnValue(buildOrchestrationClient(rows).client);

    const { updated } = await completePostBatchJob({
      jobId: "job_1",
      postedUrls: [{ postId: "post_1", platform: "Instagram", url: "https://ig.test/p/1" }],
    });

    expect(updated).toBe(1);
    expect(mockSendResendEmail).toHaveBeenCalledTimes(3);
    const call = mockSendResendEmail.mock.calls[0][0];
    expect(call.subject).toBe("Match Fit content fully posted — 2026-07-27");
    expect(call.text).toContain("Static on Instagram: https://ig.test/p/1");
    expect(mockRecordDayAllPostedEmailSent).toHaveBeenCalledWith("2026-07-27");
  });

  it("does not send when a sibling post for the date is still outstanding", async () => {
    const rows = [
      makePost({ id: "post_1", workflow_stage: "publishing", post_type: "Static" }),
      makePost({ id: "post_2", workflow_stage: "publishing", post_type: "Video" }),
    ];
    mockCreateNiBrainClient.mockReturnValue(buildOrchestrationClient(rows).client);

    await completePostBatchJob({
      jobId: "job_1",
      postedUrls: [{ postId: "post_1", platform: "Instagram", url: "https://ig.test/p/1" }],
    });

    expect(mockSendResendEmail).not.toHaveBeenCalled();
    expect(mockRecordDayAllPostedEmailSent).not.toHaveBeenCalled();
  });
});

describe("notifyDayScheduled", () => {
  it("sends the scheduled email with the media-build ETA by default", async () => {
    await notifyDayScheduled("2026-07-27");

    expect(mockSendResendEmail).toHaveBeenCalledTimes(3);
    const call = mockSendResendEmail.mock.calls[0][0];
    expect(call.subject).toBe("Match Fit content scheduled — 2026-07-27");
    expect(call.text).toContain("Media build ETA:");
    expect(mockRecordDayScheduledEmailSent).toHaveBeenCalledWith("2026-07-27");
  });

  it("does not send when the scheduled email has already gone out for the date", async () => {
    mockHasDayScheduledEmailBeenSent.mockResolvedValue(true);

    await notifyDayScheduled("2026-07-27");

    expect(mockSendResendEmail).not.toHaveBeenCalled();
    expect(mockRecordDayScheduledEmailSent).not.toHaveBeenCalled();
  });

  it("uses the posting ETA when etaKind is 'posting'", async () => {
    await notifyDayScheduled("2026-07-27", { etaKind: "posting" });

    const call = mockSendResendEmail.mock.calls[0][0];
    expect(call.text).toContain("Posting ETA:");
    expect(call.text).not.toContain("Media build ETA:");
  });
});

describe("maybeNotifyDayFullyPosted", () => {
  it("short-circuits without touching the client when postDate is empty", async () => {
    const result = await maybeNotifyDayFullyPosted("");

    expect(result).toEqual({ notified: false });
    expect(mockHasDayAllPostedEmailBeenSent).not.toHaveBeenCalled();
    expect(mockCreateNiBrainClient).not.toHaveBeenCalled();
  });

  it("short-circuits without touching the client when the fully-posted email was already sent", async () => {
    mockHasDayAllPostedEmailBeenSent.mockResolvedValue(true);

    const result = await maybeNotifyDayFullyPosted("2026-07-27");

    expect(result).toEqual({ notified: false });
    expect(mockCreateNiBrainClient).not.toHaveBeenCalled();
  });

  it("returns notified:false without emailing when the date is not fully posted", async () => {
    const rows = [makePost({ workflow_stage: "publishing", archive_type: null })];
    mockCreateNiBrainClient.mockReturnValue(buildOrchestrationClient(rows).client);

    const result = await maybeNotifyDayFullyPosted("2026-07-27");

    expect(result).toEqual({ notified: false });
    expect(mockSendResendEmail).not.toHaveBeenCalled();
    expect(mockRecordDayAllPostedEmailSent).not.toHaveBeenCalled();
  });

  it("sends the fully-posted email with one line per post/platform when every post is archived as posted", async () => {
    const rows = [
      makePost({
        id: "post_1",
        workflow_stage: "archived",
        archive_type: "posted",
        post_type: "Static",
        posted_urls: { Instagram: "https://ig.test/p/1" },
      }),
      makePost({
        id: "post_2",
        workflow_stage: "archived",
        archive_type: "posted",
        post_type: "Video",
        posted_urls: { TikTok: "https://tiktok.test/p/2" },
      }),
    ];
    mockCreateNiBrainClient.mockReturnValue(buildOrchestrationClient(rows).client);

    const result = await maybeNotifyDayFullyPosted("2026-07-27");

    expect(result).toEqual({ notified: true });
    expect(mockSendResendEmail).toHaveBeenCalledTimes(3);
    const call = mockSendResendEmail.mock.calls[0][0];
    expect(call.text).toContain("Static on Instagram: https://ig.test/p/1");
    expect(call.text).toContain("Video on TikTok: https://tiktok.test/p/2");
    expect(mockRecordDayAllPostedEmailSent).toHaveBeenCalledWith("2026-07-27");
  });
});

describe("manuallyGenerateDayMedia", () => {
  it("throws when there are no hub posts for the date", async () => {
    mockCreateNiBrainClient.mockReturnValue(buildOrchestrationClient([]).client);

    await expect(manuallyGenerateDayMedia("2026-07-27")).rejects.toThrow(
      "No hub posts found for this date to approve.",
    );
  });

  it("moves media and text posts straight to publishing and sends a posting-ETA notification", async () => {
    const rows = [
      makePost({ id: "post_1", post_type: "Static" }),
      makePost({ id: "post_2", post_type: "Text" }),
    ];
    mockCreateNiBrainClient.mockReturnValue(buildOrchestrationClient(rows).client);

    const result = await manuallyGenerateDayMedia("2026-07-27");

    expect(result).toEqual({ moved: 2, memoId: "memo_1" });
    expect(rows[0].workflow_stage).toBe("publishing");
    expect(rows[0].status).toBe("publishing");
    expect(rows[0].approved_at).toBeTruthy();
    expect(rows[1].workflow_stage).toBe("publishing");

    expect(mockSendResendEmail).toHaveBeenCalledTimes(3);
    const call = mockSendResendEmail.mock.calls[0][0];
    expect(call.text).toContain("Posting ETA:");
    expect(mockRecordDayScheduledEmailSent).toHaveBeenCalledWith("2026-07-27");
  });

  it("sends no schedule notification for a text-only day", async () => {
    const rows = [makePost({ id: "post_1", post_type: "Text" })];
    mockCreateNiBrainClient.mockReturnValue(buildOrchestrationClient(rows).client);

    const result = await manuallyGenerateDayMedia("2026-07-27");

    expect(result).toEqual({ moved: 1, memoId: "memo_1" });
    expect(rows[0].workflow_stage).toBe("publishing");
    expect(mockSendResendEmail).not.toHaveBeenCalled();
    expect(mockRecordDayScheduledEmailSent).not.toHaveBeenCalled();
  });
});

describe("fireCoworkForPost", () => {
  it("throws when the post is not found", async () => {
    mockCreateNiBrainClient.mockReturnValue(buildOrchestrationClient([]).client);

    await expect(fireCoworkForPost("post_missing")).rejects.toThrow("Post not found.");
  });

  it("throws for a Text post — nothing to generate", async () => {
    const rows = [makePost({ post_type: "Text" })];
    mockCreateNiBrainClient.mockReturnValue(buildOrchestrationClient(rows).client);

    await expect(fireCoworkForPost("post_1")).rejects.toThrow("Text posts have no media to generate.");
  });

  it("updates the post to pending, creates the job, and returns job+post", async () => {
    const rows = [makePost({ post_type: "Static", platforms: "Instagram, Threads" })];
    const { client, captured } = buildOrchestrationClient(rows);
    mockCreateNiBrainClient.mockReturnValue(client);

    const { job, post } = await fireCoworkForPost("post_1");

    expect(post.workflow_stage).toBe("pending");
    expect(post.status).toBe("pending");
    expect(post.media_status).toBe("generating");
    expect(post.media_generation_started_at).toBeTruthy();
    expect(post.last_generation_prompt).toBeTruthy();

    expect(captured.jobInserts).toHaveLength(1);
    const insertedBrief = captured.jobInserts[0].brief as { order: string[]; prompts: Record<string, { postId: string }> };
    expect(insertedBrief.order).toEqual(["static"]);
    expect(insertedBrief.prompts.static.postId).toBe("post_1");

    expect(captured.jobBriefUpdates).toHaveLength(1);
    const briefUpdate = captured.jobBriefUpdates[0].brief as { callback: { url: string } };
    expect(briefUpdate.callback.url).toContain(`/cowork-jobs/${job.id}/complete`);

    const returnedBrief = job.brief as { callback: { url: string } };
    expect(returnedBrief.callback.url).toContain(`/cowork-jobs/${job.id}/complete`);
  });

  it("appends operator feedback text to the generation prompt when provided", async () => {
    const rows = [makePost({ post_type: "Static" })];
    mockCreateNiBrainClient.mockReturnValue(buildOrchestrationClient(rows).client);

    const { post } = await fireCoworkForPost("post_1", { feedback: "Make it brighter" });

    expect(post.last_generation_prompt as string).toContain(
      "OPERATOR FEEDBACK — apply these adjustments:\nMake it brighter",
    );
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
