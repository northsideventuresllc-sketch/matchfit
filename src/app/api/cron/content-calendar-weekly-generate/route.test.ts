import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression guard for the chained-hops refactor (MF-CONTENT-GEN-VERCEL-504-0907, PR #368).
// The weekly cron route runs the heavy shared plan ONCE, then fans out one same-origin hop per
// weekday: each hop URL carries `dayHop=<json>` and NO `secret`/`weekStart` param, authenticating
// with an `Authorization: Bearer <secret>` header. A `?dayHop=` request acks immediately and runs
// exactly one day's bounded generation in after(). `after` and `fetch` are mocked so the deferred
// dispatch actually runs and is inspectable.

const { afterCallbacks, mockJson, mockAfter, mockEnsureSchema, mockHydrate, mockPlanWeekly, mockGenerateDay } =
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
      mockPlanWeekly: vi.fn(),
      mockGenerateDay: vi.fn(),
    };
  });

vi.mock("next/server", () => ({
  NextResponse: { json: mockJson },
  after: mockAfter,
}));
vi.mock("@/lib/ensure-content-hub-schema", () => ({ ensureContentCalendarV22Schema: mockEnsureSchema }));
vi.mock("@/lib/hydrate-platform-env", () => ({ hydratePlatformEnvFromDatabase: mockHydrate }));
vi.mock("@/lib/content-calendar/weekly-generation", () => ({
  planWeeklyGeneration: mockPlanWeekly,
  generateWeeklyDayPosts: mockGenerateDay,
}));

import { GET } from "@/app/api/cron/content-calendar-weekly-generate/route";

const SECRET = "test-secret";
const ROUTE = "https://match-fit.net/api/cron/content-calendar-weekly-generate";

const HASHTAGS = {
  researchedAt: "2026-09-07T00:00:00.000Z",
  usedWebSearch: true,
  provider: "axon-local",
  hashtags: ["MatchFit", "fitness"],
  trends: [],
  notes: null,
};

function dayPlan(dayIndex: number) {
  return {
    dayIndex,
    theme: `theme ${dayIndex}`,
    targetAudience: "Clients",
    cta: "Drive to match-fit.net/client/sign-up",
    dpmoRationale: "rationale",
  };
}

const PLAN = {
  weekStart: "2026-09-07",
  dpmoPhase: "phase1",
  socialScanSnapshotId: "scan_1",
  hashtags: HASHTAGS,
  plan: [0, 1, 2, 3, 4].map(dayPlan),
};

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
  mockPlanWeekly.mockResolvedValue(PLAN);
  mockGenerateDay.mockResolvedValue({ dayIndex: 0, postDate: "2026-09-07", created: 2 });
  fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", fetchMock);
});

describe("weekly content-calendar cron route — hop fan-out", () => {
  it("rejects an unauthorized request without planning or dispatching", async () => {
    const res = (await GET(new Request(ROUTE))) as unknown as JsonRes;

    expect(res.status).toBe(401);
    expect(mockPlanWeekly).not.toHaveBeenCalled();
    expect(mockAfter).not.toHaveBeenCalled();
  });

  it("plans once then dispatches one hop per weekday, each carrying dayHop= and Bearer auth but no secret/weekStart param", async () => {
    // Authorized by query secret + weekStart on the incoming request — proves both are stripped from hops.
    const res = (await GET(new Request(`${ROUTE}?secret=${SECRET}&weekStart=2026-09-07`))) as unknown as JsonRes;

    expect(mockPlanWeekly).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.body.dispatched).toEqual([0, 1, 2, 3, 4]);
    expect(res.body.weekStart).toBe("2026-09-07");
    // The top-level request itself generated nothing.
    expect(mockGenerateDay).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled(); // deferred into after()

    await runAfterCallbacks();

    expect(fetchMock).toHaveBeenCalledTimes(5);
    const seenDays: number[] = [];
    for (const call of fetchMock.mock.calls) {
      const url = String(call[0]);
      const opts = call[1] as { headers: { authorization: string } };
      const params = new URL(url).searchParams;
      const raw = params.get("dayHop");
      expect(raw).toBeTruthy();
      const payload = JSON.parse(raw as string) as { dayPlan: { dayIndex: number }; weekStart: string };
      seenDays.push(payload.dayPlan.dayIndex);
      expect(payload.weekStart).toBe("2026-09-07");
      expect(params.has("secret")).toBe(false);
      expect(params.has("weekStart")).toBe(false);
      expect(opts.headers.authorization).toBe(`Bearer ${SECRET}`);
    }
    expect(seenDays.sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it("a ?dayHop= request acks immediately and runs exactly one day's generation in after()", async () => {
    const payload = {
      weekStart: "2026-09-07",
      dpmoPhase: "phase1",
      socialScanSnapshotId: "scan_1",
      hashtags: HASHTAGS,
      dayPlan: dayPlan(3),
    };
    const url = `${ROUTE}?dayHop=${encodeURIComponent(JSON.stringify(payload))}`;

    const res = (await GET(new Request(url, { headers: { authorization: `Bearer ${SECRET}` } }))) as unknown as JsonRes;

    // Immediate ack — no planning, no fan-out on a hop.
    expect(res.status).toBe(200);
    expect(res.body.accepted).toBe(3);
    expect(mockPlanWeekly).not.toHaveBeenCalled();
    expect(mockGenerateDay).not.toHaveBeenCalled(); // still deferred

    await runAfterCallbacks();

    expect(mockGenerateDay).toHaveBeenCalledTimes(1);
    expect(mockGenerateDay.mock.calls[0][0].dayPlan.dayIndex).toBe(3);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
