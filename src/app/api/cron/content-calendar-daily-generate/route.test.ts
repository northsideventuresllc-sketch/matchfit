import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression guard for the chained-hops refactor (MF-CONTENT-GEN-VERCEL-504-0907, PR #368).
// The daily cron route's job is the hop FAN-OUT decision, not the leaf generation:
//   - a plain top-level request does the cheap missing-type lookup, then dispatches ONE same-origin
//     hop per missing post type and returns the fast { dispatched: [...] } ack;
//   - each hop URL carries `postType=` and NO `secret` query param, authenticating instead with an
//     `Authorization: Bearer <secret>` header;
//   - a `?postType=` hop request acks immediately and runs exactly one bounded generation in after().
// `after` and `fetch` are mocked so the deferred dispatch actually runs and is inspectable.

const { afterCallbacks, mockJson, mockAfter, mockEnsureSchema, mockHydrate, mockGetDailyMissing, mockRunDaily } =
  vi.hoisted(() => {
    const afterCallbacks: Array<() => unknown> = [];
    return {
      afterCallbacks,
      mockJson: vi.fn((body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, body })),
      mockAfter: vi.fn((cb: () => unknown) => {
        afterCallbacks.push(cb);
      }),
      mockEnsureSchema: vi.fn(),
      mockHydrate: vi.fn(),
      mockGetDailyMissing: vi.fn(),
      mockRunDaily: vi.fn(),
    };
  });

vi.mock("next/server", () => ({
  NextResponse: { json: mockJson },
  after: mockAfter,
}));
vi.mock("@/lib/ensure-content-hub-schema", () => ({ ensureContentCalendarV22Schema: mockEnsureSchema }));
vi.mock("@/lib/hydrate-platform-env", () => ({ hydratePlatformEnvFromDatabase: mockHydrate }));
vi.mock("@/lib/content-calendar/daily-generation", () => ({
  getDailyMissingPostTypes: mockGetDailyMissing,
  runDailyContentGeneration: mockRunDaily,
}));

import { GET } from "@/app/api/cron/content-calendar-daily-generate/route";

const SECRET = "test-secret";
const ROUTE = "https://match-fit.net/api/cron/content-calendar-daily-generate";

type FetchMock = ReturnType<typeof vi.fn>;
let fetchMock: FetchMock;

type JsonRes = { status: number; body: Record<string, unknown> };
async function runAfterCallbacks() {
  for (const cb of afterCallbacks) await cb();
}

beforeEach(() => {
  vi.clearAllMocks();
  afterCallbacks.length = 0;
  process.env.CRON_SECRET = SECRET;
  mockEnsureSchema.mockResolvedValue(undefined);
  mockHydrate.mockResolvedValue(undefined);
  mockRunDaily.mockResolvedValue({ ran: true, createdPostTypes: ["Video"] });
  fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", fetchMock);
});

describe("daily content-calendar cron route — hop fan-out", () => {
  it("rejects an unauthorized request without touching the pipeline", async () => {
    const res = (await GET(new Request(ROUTE))) as unknown as JsonRes;

    expect(res.status).toBe(401);
    expect(mockGetDailyMissing).not.toHaveBeenCalled();
    expect(mockAfter).not.toHaveBeenCalled();
  });

  it("dispatches one hop per missing post type, each with postType= and Bearer auth but no secret param", async () => {
    mockGetDailyMissing.mockResolvedValue({
      ran: true,
      weekStart: "2026-08-31",
      postDate: "2026-09-02",
      dayIndex: 2,
      dayFormats: ["Carousel", "Video"],
      missingPostTypes: ["Carousel", "Video"],
    });

    // Authorized by query secret on the incoming request — proves the hop URLs strip it.
    const res = (await GET(new Request(`${ROUTE}?secret=${SECRET}`))) as unknown as JsonRes;

    // Fast top-level ack: the { dispatched: [...] } shape, not the generation result.
    expect(res.status).toBe(200);
    expect(res.body.dispatched).toEqual(["Carousel", "Video"]);
    expect(res.body.weekStart).toBe("2026-08-31");
    // The top-level request itself did NOT generate anything.
    expect(mockRunDaily).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled(); // deferred into after()

    await runAfterCallbacks();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const seenTypes: string[] = [];
    for (const call of fetchMock.mock.calls) {
      const url = String(call[0]);
      const opts = call[1] as { headers: { authorization: string } };
      const params = new URL(url).searchParams;
      const postType = params.get("postType");
      expect(postType).toBeTruthy();
      seenTypes.push(postType as string);
      expect(params.has("secret")).toBe(false);
      expect(url).not.toContain("secret=");
      expect(opts.headers.authorization).toBe(`Bearer ${SECRET}`);
    }
    expect(seenTypes.sort()).toEqual(["Carousel", "Video"]);
  });

  it("returns the slot as-is (no hops) when nothing is missing", async () => {
    mockGetDailyMissing.mockResolvedValue({
      ran: true,
      weekStart: "2026-08-31",
      postDate: "2026-09-02",
      dayIndex: 2,
      dayFormats: ["Carousel", "Video"],
      missingPostTypes: [],
    });

    const res = (await GET(new Request(ROUTE, { headers: { authorization: `Bearer ${SECRET}` } }))) as unknown as JsonRes;

    expect(res.status).toBe(200);
    expect(res.body.dispatched).toBeUndefined();
    await runAfterCallbacks();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("?sync=1 runs the day's generation INLINE (no after(), no hops) and returns after the write", async () => {
    mockRunDaily.mockResolvedValue({ ran: true, createdPostTypes: ["Carousel", "Video"] });

    const res = (await GET(
      new Request(`${ROUTE}?sync=1&date=2026-09-07`, { headers: { authorization: `Bearer ${SECRET}` } }),
    )) as unknown as JsonRes;

    // Ran inline: the result is returned in the response, not deferred.
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("sync");
    expect((res.body.result as { createdPostTypes: string[] }).createdPostTypes).toEqual(["Carousel", "Video"]);
    // The whole day was generated synchronously by the top-level request itself...
    expect(mockRunDaily).toHaveBeenCalledTimes(1);
    expect(mockRunDaily).toHaveBeenCalledWith({ date: "2026-09-07" });
    // ...with NO background hop and NO same-origin fan-out — nothing left to get cut off.
    expect(mockAfter).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockGetDailyMissing).not.toHaveBeenCalled();
  });

  it("a ?postType= hop acks immediately and runs exactly one bounded generation in after()", async () => {
    const res = (await GET(
      new Request(`${ROUTE}?postType=Video`, { headers: { authorization: `Bearer ${SECRET}` } }),
    )) as unknown as JsonRes;

    // Immediate ack — the missing-type lookup and fan-out are skipped on a hop.
    expect(res.status).toBe(200);
    expect(res.body.accepted).toBe("Video");
    expect(mockGetDailyMissing).not.toHaveBeenCalled();
    expect(mockRunDaily).not.toHaveBeenCalled(); // still deferred

    await runAfterCallbacks();

    expect(mockRunDaily).toHaveBeenCalledTimes(1);
    expect(mockRunDaily).toHaveBeenCalledWith({ date: undefined, onlyPostType: "Video" });
    // A hop never re-dispatches further hops.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
