import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

function resetEnvironment() {
  process.env = { ...originalEnv };
}

function readBodyValue(body: unknown, key: string): string | null {
  if (body instanceof URLSearchParams) return body.get(key);
  return new URLSearchParams(String(body ?? "")).get(key);
}

async function importTurnstileVerify() {
  vi.resetModules();
  return import("@/lib/turnstile-verify");
}

afterEach(() => {
  resetEnvironment();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("verifyTurnstileToken", () => {
  it("skips verification when secret is unset", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    delete process.env.MATCH_FIT_TURNSTILE_STRICT;

    const { verifyTurnstileToken } = await importTurnstileVerify();
    const result = await verifyTurnstileToken(undefined);
    expect(result).toEqual({ ok: true });
  });

  it("fails closed in strict mode when secret is unset but site key is set", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    process.env.MATCH_FIT_TURNSTILE_STRICT = "1";

    vi.spyOn(console, "error").mockImplementation(() => {});
    const { verifyTurnstileToken } = await importTurnstileVerify();
    const result = await verifyTurnstileToken(undefined);
    expect(result).toEqual({
      ok: false,
      error:
        "Sign-in security is not fully configured yet. Add TURNSTILE_SECRET_KEY in Vercel (Turnstile secret for this site), then redeploy.",
      status: 503,
    });
  });

  it("accepts any token when Cloudflare dummy key pair is configured", async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
    process.env.TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";

    const { verifyTurnstileToken } = await importTurnstileVerify();
    await expect(verifyTurnstileToken("dummy-token")).resolves.toEqual({ ok: true });
  });

  it("requires a token when server verification is enabled", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({ success: true }),
      })),
    );

    const { verifyTurnstileToken } = await importTurnstileVerify();
    await expect(verifyTurnstileToken(undefined)).resolves.toEqual({
      ok: false,
      error: "Complete the security check before continuing.",
      status: 400,
    });
  });

  it("forwards cf-connecting-ip to Cloudflare siteverify", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";

    const fetchMock = vi.fn(async () => ({
      json: async () => ({ success: true }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { verifyTurnstileToken } = await importTurnstileVerify();
    const req = new Request("https://example.com/login", {
      headers: {
        "cf-connecting-ip": "203.0.113.1",
        "x-forwarded-for": "198.51.100.4, 198.51.100.5",
      },
    });
    await verifyTurnstileToken("token-abc", req);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls[0] as [unknown, RequestInit?] | undefined;
    const init = firstCall?.[1];
    expect(readBodyValue(init?.body, "secret")).toBe("test-secret");
    expect(readBodyValue(init?.body, "response")).toBe("token-abc");
    expect(readBodyValue(init?.body, "remoteip")).toBe("203.0.113.1");
  });

  it("falls back to first x-forwarded-for IP when cf header is missing", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";

    const fetchMock = vi.fn(async () => ({
      json: async () => ({ success: true }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { verifyTurnstileToken } = await importTurnstileVerify();
    const req = new Request("https://example.com/login", {
      headers: { "x-forwarded-for": "198.51.100.4, 198.51.100.5" },
    });
    await verifyTurnstileToken("token-abc", req);

    const firstCall = fetchMock.mock.calls[0] as [unknown, RequestInit?] | undefined;
    const init = firstCall?.[1];
    expect(readBodyValue(init?.body, "remoteip")).toBe("198.51.100.4");
  });

  it("returns an expiry-specific error when siteverify reports timeout-or-duplicate", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({ success: false, "error-codes": ["timeout-or-duplicate"] }),
      })),
    );

    const { verifyTurnstileToken } = await importTurnstileVerify();
    await expect(verifyTurnstileToken("expired-token")).resolves.toEqual({
      ok: false,
      error: "Security check expired. Complete the check again and submit right away.",
      status: 400,
    });
  });

  it("returns service-unavailable when siteverify request throws", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("network down"))));

    const { verifyTurnstileToken } = await importTurnstileVerify();
    await expect(verifyTurnstileToken("token-abc")).resolves.toEqual({
      ok: false,
      error: "Security verification could not be completed. Try again.",
      status: 503,
    });
  });
});

describe("probeTurnstileSecretKey", () => {
  it("returns missing when secret unset", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const { probeTurnstileSecretKey } = await importTurnstileVerify();
    await expect(probeTurnstileSecretKey()).resolves.toBe("missing");
  });

  it("returns ok immediately for Cloudflare dummy key pair", async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
    process.env.TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { probeTurnstileSecretKey } = await importTurnstileVerify();
    await expect(probeTurnstileSecretKey()).resolves.toBe("ok");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns invalid when Cloudflare reports invalid-secret", async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({ success: false, "error-codes": ["invalid-secret"] }),
      })),
    );

    const { probeTurnstileSecretKey } = await importTurnstileVerify();
    await expect(probeTurnstileSecretKey()).resolves.toBe("invalid");
  });

  it("returns ok when Cloudflare accepts the secret", async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({ success: false, "error-codes": ["invalid-input-response"] }),
      })),
    );

    const { probeTurnstileSecretKey } = await importTurnstileVerify();
    await expect(probeTurnstileSecretKey()).resolves.toBe("ok");
  });

  it("returns invalid when the probe request fails", async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("probe failure"))));

    const { probeTurnstileSecretKey } = await importTurnstileVerify();
    await expect(probeTurnstileSecretKey()).resolves.toBe("invalid");
  });
});

describe("getTurnstileRuntimeStatus", () => {
  it("reports each runtime toggle from environment configuration", async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    process.env.TURNSTILE_SECRET_KEY = "secret-key";
    process.env.MATCH_FIT_TURNSTILE_STRICT = "true";

    const { getTurnstileRuntimeStatus } = await importTurnstileVerify();
    expect(getTurnstileRuntimeStatus()).toEqual({
      clientWidgetEnabled: true,
      serverVerificationEnabled: true,
      fullyConfigured: true,
      strictMode: true,
      usingDummyKeys: false,
    });
  });
});
