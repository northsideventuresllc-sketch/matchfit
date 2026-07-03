import "server-only";

import {
  isPlaceholderResendApiKey,
  isPlaceholderResendFromEmail,
  isPlaceholderStripePublishableKey,
  isPlaceholderStripeSecretKey,
  isPlaceholderStripeWebhookSecret,
  readPlatformSecret,
  resolvePlatformSecret,
} from "@/lib/platform-secrets";
import { resetStripeClient } from "@/lib/stripe-server";

let hydratePromise: Promise<void> | null = null;

function isValidAnthropicApiKey(key: string | null | undefined): boolean {
  return Boolean(key?.trim().startsWith("sk-ant-"));
}

function isValidOpenAiApiKey(key: string | null | undefined): boolean {
  const trimmed = key?.trim();
  return Boolean(trimmed && (trimmed.startsWith("sk-") || trimmed.startsWith("sk-proj-")));
}

function isValidGeminiApiKey(key: string | null | undefined): boolean {
  const trimmed = key?.trim();
  if (!trimmed) return false;
  return trimmed.startsWith("AIza") || trimmed.startsWith("AQ.");
}

/** Clears cached platform env hydration (call after rotating platform_secrets). */
export function resetHydratePlatformEnvCache(): void {
  hydratePromise = null;
}

/** Loads live Stripe, Resend, Anthropic, OpenAI, NI Brain, and ad platform config from `platform_secrets` when env is missing. */
export async function hydratePlatformEnvFromDatabase(): Promise<void> {
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    const secret = await resolvePlatformSecret(
      "STRIPE_SECRET_KEY",
      process.env.STRIPE_SECRET_KEY,
      isPlaceholderStripeSecretKey,
    );
    if (secret) process.env.STRIPE_SECRET_KEY = secret;

    const publishable = await resolvePlatformSecret(
      "STRIPE_PUBLISHABLE_KEY",
      process.env.STRIPE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      isPlaceholderStripePublishableKey,
    );
    if (publishable) {
      process.env.STRIPE_PUBLISHABLE_KEY = publishable;
      if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()) {
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = publishable;
      }
    }

    const webhook = await resolvePlatformSecret(
      "STRIPE_WEBHOOK_SECRET",
      process.env.STRIPE_WEBHOOK_SECRET,
      isPlaceholderStripeWebhookSecret,
    );
    if (webhook) process.env.STRIPE_WEBHOOK_SECRET = webhook;

    const resendKey = await readPlatformSecret("RESEND_API_KEY");
    if (resendKey) {
      process.env.RESEND_API_KEY = resendKey;
    } else {
      const resolved = await resolvePlatformSecret(
        "RESEND_API_KEY",
        process.env.RESEND_API_KEY,
        isPlaceholderResendApiKey,
      );
      if (resolved) process.env.RESEND_API_KEY = resolved;
    }

    const resendFrom = await readPlatformSecret("RESEND_FROM_EMAIL");
    if (resendFrom) {
      process.env.RESEND_FROM_EMAIL = resendFrom;
    } else {
      const resolved = await resolvePlatformSecret(
        "RESEND_FROM_EMAIL",
        process.env.RESEND_FROM_EMAIL,
        isPlaceholderResendFromEmail,
      );
      if (resolved) process.env.RESEND_FROM_EMAIL = resolved;
    }

    if (!isValidAnthropicApiKey(process.env.ANTHROPIC_API_KEY)) {
      const anthropicKey = await readPlatformSecret("ANTHROPIC_API_KEY");
      if (anthropicKey) {
        process.env.ANTHROPIC_API_KEY = anthropicKey;
      }
    }

    if (!process.env.ANTHROPIC_ADMIN_ANALYTICS_MODEL?.trim()) {
      const anthropicModel = await readPlatformSecret("ANTHROPIC_ADMIN_ANALYTICS_MODEL");
      if (anthropicModel) {
        process.env.ANTHROPIC_ADMIN_ANALYTICS_MODEL = anthropicModel;
      }
    }

    if (!isValidOpenAiApiKey(process.env.OPENAI_API_KEY)) {
      const openAiKey = await readPlatformSecret("OPENAI_API_KEY");
      if (openAiKey) {
        process.env.OPENAI_API_KEY = openAiKey;
      }
    }

    if (!process.env.OPENAI_ADMIN_ANALYTICS_MODEL?.trim()) {
      const openAiModel = await readPlatformSecret("OPENAI_ADMIN_ANALYTICS_MODEL");
      if (openAiModel) {
        process.env.OPENAI_ADMIN_ANALYTICS_MODEL = openAiModel;
      }
    }

    if (!isValidGeminiApiKey(process.env.GEMINI_API_KEY)) {
      const geminiKey = await readPlatformSecret("GEMINI_API_KEY");
      if (geminiKey) {
        process.env.GEMINI_API_KEY = geminiKey;
      }
    }

    if (!isValidGeminiApiKey(process.env.GEMINI_API_KEY_BACKUP)) {
      const geminiBackupKey = await readPlatformSecret("GEMINI_API_KEY_BACKUP");
      if (geminiBackupKey) {
        process.env.GEMINI_API_KEY_BACKUP = geminiBackupKey;
      }
    }

    if (!process.env.GEMINI_MODEL?.trim()) {
      const geminiModel = await readPlatformSecret("GEMINI_MODEL");
      if (geminiModel) {
        process.env.GEMINI_MODEL = geminiModel;
      }
    }

    if (!process.env.GEMINI_CONTENT_CALENDAR_MODEL?.trim()) {
      const geminiCalendarModel = await readPlatformSecret("GEMINI_CONTENT_CALENDAR_MODEL");
      if (geminiCalendarModel) {
        process.env.GEMINI_CONTENT_CALENDAR_MODEL = geminiCalendarModel;
      }
    }

    const niBrainUrl = await readPlatformSecret("NI_BRAIN_SUPABASE_URL");
    if (niBrainUrl) {
      process.env.NI_BRAIN_SUPABASE_URL = niBrainUrl;
    }

    const niBrainServiceRoleKey = await readPlatformSecret("NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY");
    if (niBrainServiceRoleKey) {
      process.env.NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY = niBrainServiceRoleKey;
    }

    const niBrainDatabaseUrl = await readPlatformSecret("NI_BRAIN_DATABASE_URL");
    if (niBrainDatabaseUrl) {
      process.env.NI_BRAIN_DATABASE_URL = niBrainDatabaseUrl;
    }

    const niBrainDatabasePassword = await readPlatformSecret("NI_BRAIN_DATABASE_PASSWORD");
    if (niBrainDatabasePassword) {
      process.env.NI_BRAIN_DATABASE_PASSWORD = niBrainDatabasePassword;
    }

    for (const adKey of [
      "META_ADS_ACCESS_TOKEN",
      "META_AD_ACCOUNT_ID",
      "GOOGLE_ADS_CUSTOMER_ID",
      "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
      "GOOGLE_ADS_DEVELOPER_TOKEN",
      "GOOGLE_ADS_REFRESH_TOKEN",
      "GOOGLE_ADS_CLIENT_ID",
      "GOOGLE_ADS_CLIENT_SECRET",
    ] as const) {
      const adValue = await readPlatformSecret(adKey);
      if (adValue && !process.env[adKey]?.trim()) {
        process.env[adKey] = adValue;
      }
    }

    const internalToolsSecret = process.env.MATCHFIT_INTERNAL_TOOLS_SECRET?.trim();
    if (!internalToolsSecret || internalToolsSecret.length < 16) {
      const fromDb = await readPlatformSecret("MATCHFIT_INTERNAL_TOOLS_SECRET");
      if (fromDb && fromDb.trim().length >= 16) {
        process.env.MATCHFIT_INTERNAL_TOOLS_SECRET = fromDb.trim();
      }
    }

    resetStripeClient();
  })();

  return hydratePromise;
}

/** @deprecated Use {@link hydratePlatformEnvFromDatabase}. */
export const hydrateStripeEnvFromDatabase = hydratePlatformEnvFromDatabase;
