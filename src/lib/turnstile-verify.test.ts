import { afterEach, describe, expect, it, vi } from "vitest";

describe("verifyTurnstileToken", () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });

  it("skips verification when secret is unset", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    delete process.env.MATCH_FIT_TURNSTILE_STRICT;

    const { verifyTurnstileToken } = await import("@/lib/turnstile-verify");
    const result = await verifyTurnstileToken(undefined);
    expect(result).toEqual({ ok: true });
  });

  it("fails closed in strict mode when secret is unset but site key is set", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    process.env.MATCH_FIT_TURNSTILE_STRICT = "1";

    const { verifyTurnstileToken } = await import("@/lib/turnstile-verify");
    const result = await verifyTurnstileToken(undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
    }
  });

  it("requires a token when secret is configured", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({ success: true }),
      })),
    );

    const { verifyTurnstileToken } = await import("@/lib/turnstile-verify");
    const missing = await verifyTurnstileToken(undefined);
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.status).toBe(400);
    }

    const ok = await verifyTurnstileToken("token-abc");
    expect(ok).toEqual({ ok: true });
  });
});

describe("probeTurnstileSecretKey", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns missing when secret unset", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const { probeTurnstileSecretKey } = await import("@/lib/turnstile-verify");
    await expect(probeTurnstileSecretKey()).resolves.toBe("missing");
  });

  it("returns ok when Cloudflare accepts the secret", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({ success: false, "error-codes": ["invalid-input-response"] }),
      })),
    );
    const { probeTurnstileSecretKey } = await import("@/lib/turnstile-verify");
    await expect(probeTurnstileSecretKey()).resolves.toBe("ok");
  });
});
