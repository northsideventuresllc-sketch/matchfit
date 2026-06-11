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

import { ensureContentHubSchema, isMissingContentHubSchemaError } from "@/lib/ensure-content-hub-schema";

describe("isMissingContentHubSchemaError", () => {
  it("detects missing saved_to_hub_at column errors", () => {
    expect(
      isMissingContentHubSchemaError(new Error("Could not find the 'saved_to_hub_at' column of 'match_fit_content_calendar_posts' in the schema cache")),
    ).toBe(true);
  });
});

describe("ensureContentHubSchema", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHydratePlatformEnvFromDatabase.mockResolvedValue(undefined);
    mockPoolQuery.mockResolvedValue(undefined);
    mockPoolEnd.mockResolvedValue(undefined);
    delete process.env.NI_BRAIN_DATABASE_URL;
  });

  it("skips migration when hub columns are already available", async () => {
    mockCreateNiBrainClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    });

    await expect(ensureContentHubSchema()).resolves.toBeUndefined();
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  it("runs migration when hub columns are missing and database url is configured", async () => {
    let calls = 0;
    mockCreateNiBrainClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          limit: vi.fn(() => {
            calls += 1;
            return Promise.resolve({
              data: null,
              error: { message: "Could not find the 'saved_to_hub_at' column" },
            });
          }),
        })),
      })),
    });
    process.env.NI_BRAIN_DATABASE_URL = "postgresql://postgres:secret@db.kxijunwgbrlfzvgkhklo.supabase.co:5432/postgres";

    await expect(ensureContentHubSchema()).rejects.toThrow(/still missing on NI Brain after migration/);
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
    expect(calls).toBeGreaterThan(1);
  });
});
