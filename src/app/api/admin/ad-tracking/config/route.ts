import { NextResponse } from "next/server";
import {
  AD_LANDING_PATHS,
  AD_TRACKING_EVENTS,
  AD_TRACKING_PIXELS,
  AD_UTM_PRESETS,
  googleAdsConversionEnvKey,
  metaPixelVerificationSnippet,
  googleAdsVerificationSnippet,
  trainerOnboardingStepCatalog,
} from "@/lib/ad-tracking-config";
import { googleAdsConversionSendTo } from "@/lib/google-ads";
import {
  getAdPlatformIntegrationStatus,
  getServerConversionIntegrationStatus,
  probeMetaInsightsAccess,
} from "@/lib/ad-platform-performance";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { requireAdminSession } from "@/lib/require-admin";
import { probeMetaCapiAccess, resolveMetaCapiCredentials } from "@/lib/server-conversion-tracking";

export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  await hydratePlatformEnvFromDatabase();

  let metaInsights: { ok: boolean; detail: string | null } | null = null;
  if (process.env.META_ADS_ACCESS_TOKEN?.trim() && process.env.META_AD_ACCOUNT_ID?.trim()) {
    try {
      const probe = await probeMetaInsightsAccess();
      metaInsights = { ok: probe.ok, detail: probe.detail };
    } catch (e) {
      metaInsights = {
        ok: false,
        detail: e instanceof Error ? e.message : "Meta Insights probe failed.",
      };
    }
  }

  let metaCapiProbe: { ok: boolean; detail: string; usedAdsTokenFallback?: boolean } | null = null;
  if (resolveMetaCapiCredentials()) {
    try {
      metaCapiProbe = await probeMetaCapiAccess();
    } catch (e) {
      metaCapiProbe = {
        ok: false,
        detail: e instanceof Error ? e.message : "Meta CAPI probe failed.",
      };
    }
  }

  const integrations = getAdPlatformIntegrationStatus({ metaInsights });
  const serverConversions = getServerConversionIntegrationStatus({ metaCapiProbe });

  return NextResponse.json({
    pixels: AD_TRACKING_PIXELS,
    events: AD_TRACKING_EVENTS,
    utmPresets: AD_UTM_PRESETS,
    landingPaths: AD_LANDING_PATHS,
    trainerOnboardingSteps: trainerOnboardingStepCatalog(),
    integrations,
    serverConversions,
    googleConversions: {
      clientSignup: {
        envKey: googleAdsConversionEnvKey("client_signup"),
        sendTo: googleAdsConversionSendTo("client_signup"),
        configured: Boolean(googleAdsConversionSendTo("client_signup")),
      },
      trainerSignup: {
        envKey: googleAdsConversionEnvKey("trainer_signup"),
        sendTo: googleAdsConversionSendTo("trainer_signup"),
        configured: Boolean(googleAdsConversionSendTo("trainer_signup")),
      },
    },
    verificationSnippets: {
      meta: metaPixelVerificationSnippet(),
      google: googleAdsVerificationSnippet(),
    },
    defaultBaseUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://match-fit.net",
  });
}
