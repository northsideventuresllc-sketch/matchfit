import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

async function importTurnstileConfig() {
  vi.resetModules();
  return import("@/lib/turnstile-config");
}

afterEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
});

describe("turnstile-config", () => {
  it("trims keys and reports enabled/full configuration state", async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "  site-key  ";
    process.env.TURNSTILE_SECRET_KEY = "  secret-key  ";

    const config = await importTurnstileConfig();

    expect(config.getTurnstileSiteKey()).toBe("site-key");
    expect(config.getTurnstileSecretKey()).toBe("secret-key");
    expect(config.isTurnstileClientEnabled()).toBe(true);
    expect(config.isTurnstileServerVerificationEnabled()).toBe(true);
    expect(config.isTurnstileFullyConfigured()).toBe(true);
  });

  it("detects Cloudflare dummy key pair", async () => {
    const config = await importTurnstileConfig();
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = config.CLOUDFLARE_TURNSTILE_DUMMY_SITE_KEY;
    process.env.TURNSTILE_SECRET_KEY = config.CLOUDFLARE_TURNSTILE_DUMMY_SECRET_KEY;

    expect(config.isTurnstileDummyKeyPair()).toBe(true);
  });

  it("supports strict mode truthy toggles", async () => {
    const config = await importTurnstileConfig();

    for (const value of ["1", "true", "yes", "TRUE", "YeS"]) {
      process.env.MATCH_FIT_TURNSTILE_STRICT = value;
      expect(config.isTurnstileStrictMode()).toBe(true);
    }
  });

  it("returns false strict mode for missing or unsupported values", async () => {
    const config = await importTurnstileConfig();

    delete process.env.MATCH_FIT_TURNSTILE_STRICT;
    expect(config.isTurnstileStrictMode()).toBe(false);

    process.env.MATCH_FIT_TURNSTILE_STRICT = "off";
    expect(config.isTurnstileStrictMode()).toBe(false);
  });

  it("exports public site key as import-time client-safe constant", async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "first-key";
    const firstImport = await importTurnstileConfig();
    expect(firstImport.TURNSTILE_SITE_KEY_PUBLIC).toBe("first-key");

    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "changed-key";
    expect(firstImport.TURNSTILE_SITE_KEY_PUBLIC).toBe("first-key");

    const secondImport = await importTurnstileConfig();
    expect(secondImport.TURNSTILE_SITE_KEY_PUBLIC).toBe("changed-key");
  });
});
