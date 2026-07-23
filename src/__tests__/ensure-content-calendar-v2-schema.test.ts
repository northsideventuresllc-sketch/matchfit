import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateNiBrainClient, mockHydratePlatformEnvFromDatabase, mockPoolQuery, mockPoolEnd } = vi.hoisted(
  () => ({
    mockCreateNiBrainClient: vi.fn(),
    mockHydratePlatformEnvFromDatabase: vi.fn(),
    mockPoolQuery: vi.fn(),
    mockPoolEnd: vi.fn(),
  }),
);

vi.mock("@/lib/ni-brain-client", () => ({
  createNiBrainClient: mockCreateNiBrainClient,
}));

vi.mock("@/lib/hydrate-platform-env", () => ({
  hydratePlatformEnvFromDatabase: mockHydratePlatformEnvFromDatabase,
}));

vi.mock("pg", () => ({
  default: {
    Pool: vi.fn(() => ({
      query: mockPoolQuery,
      end: mockPoolEnd,
    })),
  },
}));

import {
  ensureContentCalendarV21Schema,
  isMissingContentCalendarV21SchemaError,
  resetContentHubSchemaMemoForTests,
} from "@/lib/ensure-content-hub-schema";

/**
 * Returns a mock NI Brain client whose `.from(table).select(cols).limit()` resolves to an
 * error when `shouldError(table, cols)` is true. All probes are `from → select → limit`.
 */
function mockClient(shouldError: (table: string, cols: string) => boolean) {
  return {
    from: (table: string) => ({
      select: (cols: string) => ({
        limit: () =>
          Promise.resolve(
            shouldError(table, cols) ? { data: null, error: { message: "does not exist" } } : { data: [], error: null },
          ),
      }),
    }),
  };
}

describe("isMissingContentCalendarV21SchemaError", () => {
  it("detects missing dpmo_phase column errors", () => {
    expect(
      isMissingContentCalendarV21SchemaError(
        new Error("Could not find the 'dpmo_phase' column of 'match_fit_content_calendar_posts' in the schema cache"),
      ),
    ).toBe(true);
  });

  it("detects a missing cowork jobs table", () => {
    expect(
      isMissingContentCalendarV21SchemaError(
        new Error('relation "match_fit_content_cowork_jobs" does not exist'),
      ),
    ).toBe(true);
  });
});

describe("ensureContentCalendarV21Schema", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetContentHubSchemaMemoForTests();
    mockHydratePlatformEnvFromDatabase.mockResolvedValue(undefined);
    mockPoolQuery.mockResolvedValue(undefined);
    mockPoolEnd.mockResolvedValue(undefined);
    delete process.env.NI_BRAIN_DATABASE_URL;
  });

  it("skips migration when all v2.1 schema is already present", async () => {
    mockCreateNiBrainClient.mockReturnValue(mockClient(() => false));

    await expect(ensureContentCalendarV21Schema()).resolves.toBeUndefined();
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  it("runs the v2.1 migration when the new schema is missing", async () => {
    // Hub + v2 posts columns exist; only v2.1 columns/tables are missing.
    mockCreateNiBrainClient.mockReturnValue(
      mockClient((table, cols) => {
        if (table !== "match_fit_content_calendar_posts") return true;
        return cols.includes("dpmo_phase");
      }),
    );
    process.env.NI_BRAIN_DATABASE_URL =
      "postgresql://postgres:secret@db.kxijunwgbrlfzvgkhklo.supabase.co:5432/postgres";

    await expect(ensureContentCalendarV21Schema()).rejects.toThrow(/v2\.1 schema is missing on NI Brain/);

    const ranV21Ddl = mockPoolQuery.mock.calls.some((call) =>
      String(call[0]).includes("match_fit_content_cowork_jobs"),
    );
    expect(ranV21Ddl).toBe(true);
  });
});
