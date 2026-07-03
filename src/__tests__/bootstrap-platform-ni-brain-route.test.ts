import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const INTERNAL_TOOLS_SECRET = "test-internal-tools-secret-16";

const {
  mockDirectPostgresUrlForDdl,
  mockPgPoolConfigForConnectionString,
  mockClearPlatformSecretCache,
  mockPoolCtor,
  mockQuery,
  mockEnd,
} = vi.hoisted(() => ({
  mockDirectPostgresUrlForDdl: vi.fn(),
  mockPgPoolConfigForConnectionString: vi.fn(),
  mockClearPlatformSecretCache: vi.fn(),
  mockPoolCtor: vi.fn(),
  mockQuery: vi.fn(),
  mockEnd: vi.fn(),
}));

vi.mock("@/lib/direct-postgres-ddl", () => ({
  directPostgresUrlForDdl: mockDirectPostgresUrlForDdl,
}));

vi.mock("@/lib/supabase-database-url", () => ({
  pgPoolConfigForConnectionString: mockPgPoolConfigForConnectionString,
}));

vi.mock("@/lib/platform-secrets", () => ({
  clearPlatformSecretCache: mockClearPlatformSecretCache,
}));

vi.mock("pg", () => ({
  default: {
    Pool: mockPoolCtor,
  },
}));

import { POST } from "@/app/api/internal/bootstrap-platform-ni-brain/route";

function postJson(
  body: {
    niBrainSupabaseUrl: string;
    niBrainServiceRoleKey: string;
  },
  bearer?: string,
): Request {
  return new Request("https://example.test/api/internal/bootstrap-platform-ni-brain", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/internal/bootstrap-platform-ni-brain", () => {
  const niBrainSupabaseUrl = "https://kxijunwgbrlfzvgkhklo.supabase.co";
  const niBrainServiceRoleKey = "service-role-key-at-least-20";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MATCHFIT_INTERNAL_TOOLS_SECRET = INTERNAL_TOOLS_SECRET;

    mockDirectPostgresUrlForDdl.mockReturnValue("postgresql://matchfit:matchfit@localhost:5432/matchfit");
    mockPgPoolConfigForConnectionString.mockReturnValue({
      connectionString: "postgresql://matchfit:matchfit@localhost:5432/matchfit",
      ssl: false,
    });
    mockPoolCtor.mockImplementation(() => ({
      query: mockQuery,
      end: mockEnd,
    }));
    mockQuery.mockResolvedValue({ rowCount: 1 });
    mockEnd.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.MATCHFIT_INTERNAL_TOOLS_SECRET;
  });

  it("returns 503 when MATCHFIT_INTERNAL_TOOLS_SECRET is not configured", async () => {
    delete process.env.MATCHFIT_INTERNAL_TOOLS_SECRET;

    const res = await POST(
      postJson(
        {
          niBrainSupabaseUrl,
          niBrainServiceRoleKey,
        },
        INTERNAL_TOOLS_SECRET,
      ),
    );

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "Internal tools are not configured." });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 401 when authorization header is missing", async () => {
    const res = await POST(
      postJson({
        niBrainSupabaseUrl,
        niBrainServiceRoleKey,
      }),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 400 when the payload is invalid", async () => {
    const res = await POST(
      postJson(
        {
          niBrainSupabaseUrl: "https://example.com",
          niBrainServiceRoleKey: "too-short",
        },
        INTERNAL_TOOLS_SECRET,
      ),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid NI Brain payload." });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 401 when the bearer token does not match MATCHFIT_INTERNAL_TOOLS_SECRET", async () => {
    const res = await POST(
      postJson(
        {
          niBrainSupabaseUrl,
          niBrainServiceRoleKey,
        },
        "different-internal-secret",
      ),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("stores both NI Brain platform secrets and clears cache", async () => {
    const res = await POST(
      postJson(
        {
          niBrainSupabaseUrl,
          niBrainServiceRoleKey,
        },
        INTERNAL_TOOLS_SECRET,
      ),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      message: "NI Brain keys stored in platform_secrets.",
    });
    expect(mockPgPoolConfigForConnectionString).toHaveBeenCalledWith(
      "postgresql://matchfit:matchfit@localhost:5432/matchfit",
    );
    expect(mockPoolCtor).toHaveBeenCalledTimes(2);
    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO public.platform_secrets"),
      ["NI_BRAIN_SUPABASE_URL", niBrainSupabaseUrl],
    );
    expect(mockQuery).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("INSERT INTO public.platform_secrets"),
      ["NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY", niBrainServiceRoleKey],
    );
    expect(mockEnd).toHaveBeenCalledTimes(2);
    expect(mockClearPlatformSecretCache).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when no direct database URL is available", async () => {
    mockDirectPostgresUrlForDdl.mockReturnValueOnce("");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await POST(
      postJson(
        {
          niBrainSupabaseUrl,
          niBrainServiceRoleKey,
        },
        INTERNAL_TOOLS_SECRET,
      ),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "No direct Postgres URL available for platform_secrets bootstrap.",
    });
    expect(mockPoolCtor).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
