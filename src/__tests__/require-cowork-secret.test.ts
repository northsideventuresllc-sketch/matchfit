import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `hasValidCoworkSecret` checks `CRON_SECRET` (env) first, then falls back to the
 * `COWORK_POLL_SECRET` row in `platform_secrets` — so a Cowork operator without Vercel
 * dashboard access can still be authorized once that DB value is provisioned.
 */

const { mockReadPlatformSecret } = vi.hoisted(() => ({
  mockReadPlatformSecret: vi.fn(),
}));

vi.mock("@/lib/platform-secrets", () => ({
  readPlatformSecret: mockReadPlatformSecret,
}));

import { hasValidCoworkSecret } from "@/lib/require-cowork-secret";

const URL_STR = "https://matchfit.test/api/admin/content-calendar/v2/cowork-jobs";

function req(opts: { bearer?: string; queryParam?: string } = {}): Request {
  const url = opts.queryParam ? `${URL_STR}?secret=${opts.queryParam}` : URL_STR;
  const headers: Record<string, string> = {};
  if (opts.bearer) headers.authorization = `Bearer ${opts.bearer}`;
  return new Request(url, { headers });
}

describe("hasValidCoworkSecret", () => {
  const ORIGINAL = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "env_secret_123";
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = ORIGINAL;
  });

  it("returns true on a Bearer match against CRON_SECRET without consulting the DB", async () => {
    const result = await hasValidCoworkSecret(req({ bearer: "env_secret_123" }));
    expect(result).toBe(true);
    expect(mockReadPlatformSecret).not.toHaveBeenCalled();
  });

  it("returns true on a query-param match against CRON_SECRET", async () => {
    const result = await hasValidCoworkSecret(req({ queryParam: "env_secret_123" }));
    expect(result).toBe(true);
  });

  it("falls back to the DB secret when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    mockReadPlatformSecret.mockResolvedValueOnce("db_secret_456");
    const result = await hasValidCoworkSecret(req({ bearer: "db_secret_456" }));
    expect(result).toBe(true);
    expect(mockReadPlatformSecret).toHaveBeenCalledWith("COWORK_POLL_SECRET");
  });

  it("falls back to the DB secret when the provided value doesn't match CRON_SECRET", async () => {
    mockReadPlatformSecret.mockResolvedValueOnce("db_secret_456");
    const result = await hasValidCoworkSecret(req({ bearer: "db_secret_456" }));
    expect(result).toBe(true);
  });

  it("returns false when neither CRON_SECRET nor the DB secret match", async () => {
    mockReadPlatformSecret.mockResolvedValueOnce("db_secret_456");
    const result = await hasValidCoworkSecret(req({ bearer: "wrong" }));
    expect(result).toBe(false);
  });

  it("returns false when no credential is provided at all", async () => {
    const result = await hasValidCoworkSecret(req());
    expect(result).toBe(false);
    expect(mockReadPlatformSecret).not.toHaveBeenCalled();
  });

  it("returns false when the DB has no secret stored either", async () => {
    delete process.env.CRON_SECRET;
    mockReadPlatformSecret.mockResolvedValueOnce(null);
    const result = await hasValidCoworkSecret(req({ bearer: "anything" }));
    expect(result).toBe(false);
  });
});
