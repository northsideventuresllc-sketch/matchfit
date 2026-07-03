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

import { POST } from "@/app/api/internal/bootstrap-platform-anthropic/route";

function postJson(body: unknown, bearer?: string): Request {
  return new Request("https://example.test/api/internal/bootstrap-platform-anthropic", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/internal/bootstrap-platform-anthropic", () => {
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
      postJson({ anthropicApiKey: "sk-ant-unit-test-key" }, INTERNAL_TOOLS_SECRET),
    );

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "Internal tools are not configured." });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 401 when authorization header is missing", async () => {
    const res = await POST(postJson({ anthropicApiKey: "sk-ant-unit-test-key" }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid payload", async () => {
    const res = await POST(postJson({ anthropicApiKey: "invalid" }, INTERNAL_TOOLS_SECRET));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid Anthropic payload." });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 401 when the bearer token does not match MATCHFIT_INTERNAL_TOOLS_SECRET", async () => {
    const res = await POST(
      postJson({ anthropicApiKey: "sk-ant-unit-test-key" }, "wrong-internal-secret"),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("stores the Anthropic key in platform_secrets and clears cache", async () => {
    const anthropicApiKey = "sk-ant-unit-test-key";

    const res = await POST(postJson({ anthropicApiKey }, INTERNAL_TOOLS_SECRET));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      message: "Anthropic API key stored in platform_secrets.",
    });
    expect(mockPgPoolConfigForConnectionString).toHaveBeenCalledWith(
      "postgresql://matchfit:matchfit@localhost:5432/matchfit",
    );
    expect(mockPoolCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: "postgresql://matchfit:matchfit@localhost:5432/matchfit",
        max: 1,
      }),
    );
    expect(mockQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("CREATE TABLE IF NOT EXISTS public.platform_secrets"),
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO public.platform_secrets"),
      ["ANTHROPIC_API_KEY", anthropicApiKey],
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO public.platform_secrets"),
      ["ANTHROPIC_ADMIN_ANALYTICS_MODEL", "claude-sonnet-4-6"],
    );
    expect(mockClearPlatformSecretCache).toHaveBeenCalledTimes(1);
    expect(mockEnd).toHaveBeenCalledTimes(2);
  });

  it("returns 500 when no direct database URL is available", async () => {
    mockDirectPostgresUrlForDdl.mockReturnValueOnce("");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await POST(
      postJson({ anthropicApiKey: "sk-ant-unit-test-key" }, INTERNAL_TOOLS_SECRET),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "No direct Postgres URL available for platform_secrets bootstrap.",
    });
    expect(errorSpy).toHaveBeenCalled();
    expect(mockPoolCtor).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
