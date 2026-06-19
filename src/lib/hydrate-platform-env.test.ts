import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readPlatformSecret = vi.fn();

vi.mock("@/lib/platform-secrets", () => ({
  readPlatformSecret,
  resolvePlatformSecret: vi.fn(async (_key: string, envValue: string | undefined) => envValue ?? null),
  isPlaceholderStripeSecretKey: () => false,
  isPlaceholderStripePublishableKey: () => false,
  isPlaceholderStripeWebhookSecret: () => false,
  isPlaceholderResendApiKey: () => false,
  isPlaceholderResendFromEmail: () => false,
}));

vi.mock("@/lib/stripe-server", () => ({
  resetStripeClient: vi.fn(),
}));

describe("hydratePlatformEnvFromDatabase", () => {
  beforeEach(() => {
    vi.resetModules();
    readPlatformSecret.mockReset();
    delete process.env.NI_BRAIN_SUPABASE_URL;
    delete process.env.NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    delete process.env.NI_BRAIN_SUPABASE_URL;
    delete process.env.NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("hydrates NI Brain, Anthropic, and OpenAI keys from platform_secrets", async () => {
    readPlatformSecret.mockImplementation(async (key: string) => {
      if (key === "NI_BRAIN_SUPABASE_URL") return "https://kxijunwgbrlfzvgkhklo.supabase.co";
      if (key === "NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY") return "service-role-jwt";
      if (key === "ANTHROPIC_API_KEY") return "sk-ant-test";
      if (key === "ANTHROPIC_ADMIN_ANALYTICS_MODEL") return "claude-sonnet-4-6";
      if (key === "OPENAI_API_KEY") return "sk-openai-test";
      if (key === "OPENAI_ADMIN_ANALYTICS_MODEL") return "gpt-4o-mini";
      return null;
    });

    const { hydratePlatformEnvFromDatabase } = await import("@/lib/hydrate-platform-env");
    await hydratePlatformEnvFromDatabase();

    expect(process.env.NI_BRAIN_SUPABASE_URL).toBe("https://kxijunwgbrlfzvgkhklo.supabase.co");
    expect(process.env.NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY).toBe("service-role-jwt");
    expect(process.env.ANTHROPIC_API_KEY).toBe("sk-ant-test");
    expect(process.env.ANTHROPIC_ADMIN_ANALYTICS_MODEL).toBe("claude-sonnet-4-6");
    expect(process.env.OPENAI_API_KEY).toBe("sk-openai-test");
    expect(process.env.OPENAI_ADMIN_ANALYTICS_MODEL).toBe("gpt-4o-mini");
  });
});
