import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateNiBrainClient } = vi.hoisted(() => ({
  mockCreateNiBrainClient: vi.fn(),
}));

vi.mock("@/lib/ni-brain-client", () => ({
  createNiBrainClient: mockCreateNiBrainClient,
}));

import {
  completeResearchRun,
  type ContentResearchRunRow,
  createRunningResearchRun,
  failResearchRun,
  getResearchRun,
  listRecentResearchRuns,
  listResearchRunArchiveMonths,
  listResearchRunsForDate,
  listResearchRunsForMonth,
  serializeResearchRun,
} from "@/lib/content-calendar/content-research-store";

beforeEach(() => {
  vi.clearAllMocks();
});

function baseRow(overrides: Partial<ContentResearchRunRow> = {}): ContentResearchRunRow {
  return {
    id: "run_1",
    status: "running",
    trigger: "manual",
    run_date: "2026-08-15",
    summary: null,
    report_body: null,
    model: null,
    error: null,
    admin_id: "admin_1",
    created_at: "2026-08-15T12:00:00.000Z",
    completed_at: null,
    ...overrides,
  };
}

describe("serializeResearchRun", () => {
  it("maps snake_case row fields to camelCase", () => {
    const row = baseRow({
      status: "complete",
      summary: "Weekly research summary",
      report_body: "Full report text",
      model: "gemini-2.5-pro",
      completed_at: "2026-08-15T13:00:00.000Z",
    });

    expect(serializeResearchRun(row)).toEqual({
      id: "run_1",
      status: "complete",
      trigger: "manual",
      runDate: "2026-08-15",
      summary: "Weekly research summary",
      reportBody: "Full report text",
      model: "gemini-2.5-pro",
      error: null,
      adminId: "admin_1",
      createdAt: "2026-08-15T12:00:00.000Z",
      completedAt: "2026-08-15T13:00:00.000Z",
    });
  });
});

describe("createRunningResearchRun", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T18:00:00Z")); // 2pm ET, safely mid-day
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("inserts a running run for today's ET calendar date", async () => {
    const insertArgs: Record<string, unknown>[] = [];
    mockCreateNiBrainClient.mockReturnValue({
      from: (table: string) => {
        if (table !== "match_fit_content_research_runs") throw new Error(`Unexpected table ${table}`);
        return {
          insert: (patch: Record<string, unknown>) => {
            insertArgs.push(patch);
            return {
              select: () => ({
                single: () => Promise.resolve({ data: baseRow(patch as Partial<ContentResearchRunRow>), error: null }),
              }),
            };
          },
        };
      },
    });

    const result = await createRunningResearchRun({ adminId: "admin_9" });

    expect(insertArgs[0]).toMatchObject({
      status: "running",
      trigger: "manual",
      run_date: "2026-08-15",
      admin_id: "admin_9",
    });
    expect(result.id).toBe("run_1");
  });

  it("throws when the insert fails", async () => {
    mockCreateNiBrainClient.mockReturnValue({
      from: () => ({
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: { message: "insert failed" } }),
          }),
        }),
      }),
    });

    await expect(createRunningResearchRun({ adminId: "admin_9" })).rejects.toThrow("insert failed");
  });
});

describe("completeResearchRun", () => {
  it("marks the run complete with the report fields", async () => {
    const updateArgs: Record<string, unknown>[] = [];
    mockCreateNiBrainClient.mockReturnValue({
      from: (table: string) => {
        if (table !== "match_fit_content_research_runs") throw new Error(`Unexpected table ${table}`);
        return {
          update: (patch: Record<string, unknown>) => {
            updateArgs.push(patch);
            return {
              eq: (col: string, val: unknown) => {
                expect(col).toBe("id");
                expect(val).toBe("run_1");
                return {
                  select: () => ({
                    single: () =>
                      Promise.resolve({
                        data: baseRow({ ...(patch as Partial<ContentResearchRunRow>), id: "run_1" }),
                        error: null,
                      }),
                  }),
                };
              },
            };
          },
        };
      },
    });

    const result = await completeResearchRun({
      id: "run_1",
      summary: "Summary text",
      reportBody: "Report body",
      model: "gemini-2.5-pro",
    });

    expect(updateArgs[0]).toMatchObject({
      status: "complete",
      summary: "Summary text",
      report_body: "Report body",
      model: "gemini-2.5-pro",
    });
    expect(updateArgs[0].completed_at).toBeTruthy();
    expect(result.status).toBe("complete");
  });

  it("throws when the update fails", async () => {
    mockCreateNiBrainClient.mockReturnValue({
      from: () => ({
        update: () => ({
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: null, error: { message: "update failed" } }),
            }),
          }),
        }),
      }),
    });

    await expect(completeResearchRun({ id: "run_1", summary: "s", reportBody: "r", model: null })).rejects.toThrow(
      "update failed",
    );
  });
});

describe("failResearchRun", () => {
  it("marks the run failed with the error reason", async () => {
    const updateArgs: Record<string, unknown>[] = [];
    mockCreateNiBrainClient.mockReturnValue({
      from: (table: string) => {
        if (table !== "match_fit_content_research_runs") throw new Error(`Unexpected table ${table}`);
        return {
          update: (patch: Record<string, unknown>) => {
            updateArgs.push(patch);
            return {
              eq: (col: string, val: unknown) => {
                expect(col).toBe("id");
                expect(val).toBe("run_1");
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      },
    });

    await failResearchRun({ id: "run_1", error: "model timed out" });

    expect(updateArgs[0]).toMatchObject({ status: "failed", error: "model timed out" });
    expect(updateArgs[0].completed_at).toBeTruthy();
  });

  it("throws when the update fails", async () => {
    mockCreateNiBrainClient.mockReturnValue({
      from: () => ({
        update: () => ({
          eq: () => Promise.resolve({ error: { message: "db down" } }),
        }),
      }),
    });

    await expect(failResearchRun({ id: "run_1", error: "boom" })).rejects.toThrow("db down");
  });
});

describe("listRecentResearchRuns", () => {
  it("selects complete runs ordered newest first, limited to the requested count", async () => {
    const orderCalls: unknown[] = [];
    const limitMock = vi.fn().mockResolvedValue({ data: [baseRow({ status: "complete" })], error: null });
    mockCreateNiBrainClient.mockReturnValue({
      from: (table: string) => {
        if (table !== "match_fit_content_research_runs") throw new Error(`Unexpected table ${table}`);
        return {
          select: () => ({
            eq: (col: string, val: unknown) => {
              expect(col).toBe("status");
              expect(val).toBe("complete");
              return {
                order: (field: string, opts: unknown) => {
                  orderCalls.push([field, opts]);
                  return {
                    order: (field2: string, opts2: unknown) => {
                      orderCalls.push([field2, opts2]);
                      return { limit: limitMock };
                    },
                  };
                },
              };
            },
          }),
        };
      },
    });

    const result = await listRecentResearchRuns(3);

    expect(result).toHaveLength(1);
    expect(limitMock).toHaveBeenCalledWith(3);
    expect(orderCalls).toEqual([
      ["run_date", { ascending: false }],
      ["created_at", { ascending: false }],
    ]);
  });

  it("defaults to a limit of 5", async () => {
    const limitMock = vi.fn().mockResolvedValue({ data: [], error: null });
    mockCreateNiBrainClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              order: () => ({ limit: limitMock }),
            }),
          }),
        }),
      }),
    });

    await listRecentResearchRuns();

    expect(limitMock).toHaveBeenCalledWith(5);
  });

  it("returns an empty array when the query has no data", async () => {
    mockCreateNiBrainClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              order: () => ({ limit: () => Promise.resolve({ data: null, error: null }) }),
            }),
          }),
        }),
      }),
    });

    await expect(listRecentResearchRuns()).resolves.toEqual([]);
  });

  it("throws when the query fails", async () => {
    mockCreateNiBrainClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              order: () => ({ limit: () => Promise.resolve({ data: null, error: { message: "query failed" } }) }),
            }),
          }),
        }),
      }),
    });

    await expect(listRecentResearchRuns()).rejects.toThrow("query failed");
  });
});

describe("listResearchRunArchiveMonths", () => {
  it("buckets completed runs by year/month, newest first", async () => {
    mockCreateNiBrainClient.mockReturnValue({
      from: (table: string) => {
        if (table !== "match_fit_content_research_runs") throw new Error(`Unexpected table ${table}`);
        return {
          select: () => ({
            eq: (col: string, val: unknown) => {
              expect(col).toBe("status");
              expect(val).toBe("complete");
              return Promise.resolve({
                data: [
                  { run_date: "2026-08-15" },
                  { run_date: "2026-08-01" },
                  { run_date: "2026-07-20" },
                  { run_date: "2026-07-05" },
                  { run_date: "2027-01-02" },
                ],
                error: null,
              });
            },
          }),
        };
      },
    });

    const result = await listResearchRunArchiveMonths();

    expect(result).toEqual([
      { year: 2027, month: 1, count: 1 },
      { year: 2026, month: 8, count: 2 },
      { year: 2026, month: 7, count: 2 },
    ]);
  });

  it("skips rows with a missing or malformed run_date", async () => {
    mockCreateNiBrainClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: [{ run_date: "" }, { run_date: null }, { run_date: "not-a-date" }, { run_date: "2026-08-15" }],
              error: null,
            }),
        }),
      }),
    });

    const result = await listResearchRunArchiveMonths();

    expect(result).toEqual([{ year: 2026, month: 8, count: 1 }]);
  });

  it("throws when the query fails", async () => {
    mockCreateNiBrainClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: null, error: { message: "query failed" } }),
        }),
      }),
    });

    await expect(listResearchRunArchiveMonths()).rejects.toThrow("query failed");
  });
});

describe("listResearchRunsForMonth", () => {
  it("filters to the given month with an exclusive next-month upper bound", async () => {
    const gteCalls: unknown[][] = [];
    const ltCalls: unknown[][] = [];
    mockCreateNiBrainClient.mockReturnValue({
      from: (table: string) => {
        if (table !== "match_fit_content_research_runs") throw new Error(`Unexpected table ${table}`);
        return {
          select: () => ({
            gte: (col: string, val: unknown) => {
              gteCalls.push([col, val]);
              return {
                lt: (col2: string, val2: unknown) => {
                  ltCalls.push([col2, val2]);
                  return {
                    order: () => ({
                      order: () => Promise.resolve({ data: [baseRow()], error: null }),
                    }),
                  };
                },
              };
            },
          }),
        };
      },
    });

    const result = await listResearchRunsForMonth(2026, 8);

    expect(gteCalls[0]).toEqual(["run_date", "2026-08-01"]);
    expect(ltCalls[0]).toEqual(["run_date", "2026-09-01"]);
    expect(result).toHaveLength(1);
  });

  it("rolls a December month over into the next January", async () => {
    let capturedLt: unknown = null;
    mockCreateNiBrainClient.mockReturnValue({
      from: () => ({
        select: () => ({
          gte: () => ({
            lt: (col: string, val: unknown) => {
              capturedLt = val;
              return {
                order: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
              };
            },
          }),
        }),
      }),
    });

    await listResearchRunsForMonth(2026, 12);

    expect(capturedLt).toBe("2027-01-01");
  });

  it("throws when the query fails", async () => {
    mockCreateNiBrainClient.mockReturnValue({
      from: () => ({
        select: () => ({
          gte: () => ({
            lt: () => ({
              order: () => ({ order: () => Promise.resolve({ data: null, error: { message: "query failed" } }) }),
            }),
          }),
        }),
      }),
    });

    await expect(listResearchRunsForMonth(2026, 8)).rejects.toThrow("query failed");
  });
});

describe("listResearchRunsForDate", () => {
  it("filters to the exact run_date, newest first", async () => {
    const eqCalls: unknown[][] = [];
    mockCreateNiBrainClient.mockReturnValue({
      from: (table: string) => {
        if (table !== "match_fit_content_research_runs") throw new Error(`Unexpected table ${table}`);
        return {
          select: () => ({
            eq: (col: string, val: unknown) => {
              eqCalls.push([col, val]);
              return {
                order: (field: string, opts: unknown) => {
                  expect(field).toBe("created_at");
                  expect(opts).toEqual({ ascending: false });
                  return Promise.resolve({ data: [baseRow()], error: null });
                },
              };
            },
          }),
        };
      },
    });

    const result = await listResearchRunsForDate("2026-08-15");

    expect(eqCalls[0]).toEqual(["run_date", "2026-08-15"]);
    expect(result).toHaveLength(1);
  });

  it("throws when the query fails", async () => {
    mockCreateNiBrainClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: null, error: { message: "query failed" } }),
          }),
        }),
      }),
    });

    await expect(listResearchRunsForDate("2026-08-15")).rejects.toThrow("query failed");
  });
});

describe("getResearchRun", () => {
  it("returns the matching row by id", async () => {
    mockCreateNiBrainClient.mockReturnValue({
      from: (table: string) => {
        if (table !== "match_fit_content_research_runs") throw new Error(`Unexpected table ${table}`);
        return {
          select: () => ({
            eq: (col: string, val: unknown) => {
              expect(col).toBe("id");
              expect(val).toBe("run_1");
              return { maybeSingle: () => Promise.resolve({ data: baseRow(), error: null }) };
            },
          }),
        };
      },
    });

    const result = await getResearchRun("run_1");

    expect(result?.id).toBe("run_1");
  });

  it("returns null when no row matches", async () => {
    mockCreateNiBrainClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
        }),
      }),
    });

    await expect(getResearchRun("missing")).resolves.toBeNull();
  });

  it("throws when the query fails", async () => {
    mockCreateNiBrainClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: { message: "query failed" } }) }),
        }),
      }),
    });

    await expect(getResearchRun("run_1")).rejects.toThrow("query failed");
  });
});
