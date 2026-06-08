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
import { getAdPlatformIntegrationStatus } from "@/lib/ad-platform-performance";
import { requireAdminSession } from "@/lib/require-admin";

export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const integrations = getAdPlatformIntegrationStatus();

  return NextResponse.json({
    pixels: AD_TRACKING_PIXELS,
    events: AD_TRACKING_EVENTS,
    utmPresets: AD_UTM_PRESETS,
    landingPaths: AD_LANDING_PATHS,
    trainerOnboardingSteps: trainerOnboardingStepCatalog(),
    integrations,
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
