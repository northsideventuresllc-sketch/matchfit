/** Client-safe ad tracking catalog — aligned with Meta Pixel and Google Ads tags in the app. */

import { GOOGLE_ADS_ID } from "@/lib/google-ads";
import { META_PIXEL_ID } from "@/lib/meta-pixel";
import { TRAINER_ONBOARDING_FUNNEL_STEPS } from "@/lib/meta-pixel-funnel";

/** Platforms with optional daily API sync in Ad Tracking HQ. */
export type AdPlatform = "google" | "meta" | "tiktok";

export type AdUtmPlatform = AdPlatform;

export type AdCampaignPlatform = AdUtmPlatform;

export type AdConversionGoal = "client_signup" | "trainer_signup";

export type AdLandingFunnel = "client" | "trainer" | "homepage";

export type AdTrackingEvent = {
  id: string;
  label: string;
  description: string;
  metaEvent: string | null;
  googleConversionKind: AdConversionGoal | null;
  funnel: AdLandingFunnel | "both";
  trigger: string;
};

export type AdUtmPreset = {
  id: string;
  label: string;
  platform: AdUtmPlatform;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  funnel: AdLandingFunnel;
};

export const AD_TRACKING_PIXELS = {
  meta: {
    id: META_PIXEL_ID,
    label: "Meta Pixel",
    eventsManagerUrl: `https://business.facebook.com/events_manager2/list/pixel/${META_PIXEL_ID}`,
    testEventsUrl: `https://business.facebook.com/events_manager2/list/pixel/${META_PIXEL_ID}/test_events`,
  },
  google: {
    id: GOOGLE_ADS_ID,
    label: "Google Ads tag (gtag.js)",
    conversionsUrl: "https://ads.google.com/aw/conversions",
  },
} as const;

export const AD_LANDING_PATHS: Record<AdLandingFunnel, { path: string; label: string }> = {
  homepage: { path: "/", label: "Homepage" },
  client: { path: "/client/sign-up", label: "Client sign-up" },
  trainer: { path: "/trainer/signup", label: "Fitness Pro sign-up" },
};

/** Events already wired in the product — use these names in Ads Manager / Google conversion goals. */
export const AD_TRACKING_EVENTS: AdTrackingEvent[] = [
  {
    id: "page_view",
    label: "Page view",
    description: "Every public page load and SPA navigation.",
    metaEvent: "PageView (+ MatchFitSiteVisit custom)",
    googleConversionKind: null,
    funnel: "both",
    trigger: "Automatic via MetaPixelRouteTracker and gtag config",
  },
  {
    id: "signup_step",
    label: "Signup funnel step",
    description: "URL-based signup progress for client and Fitness Pro flows.",
    metaEvent: "MatchFitSignupStep + ViewContent",
    googleConversionKind: null,
    funnel: "both",
    trigger: "Automatic on mapped signup routes",
  },
  {
    id: "lead",
    label: "Lead",
    description: "Profile created before paid subscription (interest signal).",
    metaEvent: "Lead",
    googleConversionKind: null,
    funnel: "both",
    trigger: "Client/Fitness Pro registration form submit",
  },
  {
    id: "initiate_checkout",
    label: "Initiate checkout",
    description: "Stripe subscription checkout session started.",
    metaEvent: "InitiateCheckout",
    googleConversionKind: null,
    funnel: "client",
    trigger: "Client subscribe page → Stripe redirect",
  },
  {
    id: "client_signup",
    label: "Client paid signup",
    description: "Primary paid conversion for client acquisition campaigns.",
    metaEvent: "Subscribe",
    googleConversionKind: "client_signup",
    funnel: "client",
    trigger: "Client subscription confirmed (same as Google client_signup)",
  },
  {
    id: "trainer_signup",
    label: "Fitness Pro registration complete",
    description: "Primary conversion for Fitness Pro acquisition campaigns.",
    metaEvent: "CompleteRegistration",
    googleConversionKind: "trainer_signup",
    funnel: "trainer",
    trigger: "Fitness Pro account created (same as Google trainer_signup)",
  },
  {
    id: "server_purchase",
    label: "Server purchase (CAPI)",
    description: "Stripe-confirmed purchases relayed via Meta Conversions API (ad-blocker safe).",
    metaEvent: "Purchase",
    googleConversionKind: null,
    funnel: "both",
    trigger:
      "Stripe webhook: membership, Client VIP, trainer service sale, registration fee, promo tokens, nudge pack",
  },
];

export const AD_UTM_PRESETS: AdUtmPreset[] = [
  {
    id: "meta_client_beta",
    label: "Meta — client beta",
    platform: "meta",
    utm_source: "facebook",
    utm_medium: "paid_social",
    utm_campaign: "client_beta_launch",
    funnel: "client",
  },
  {
    id: "meta_trainer_beta",
    label: "Meta — Fitness Pro beta",
    platform: "meta",
    utm_source: "facebook",
    utm_medium: "paid_social",
    utm_campaign: "trainer_beta_launch",
    funnel: "trainer",
  },
  {
    id: "meta_instagram_reels",
    label: "Meta — Instagram Reels",
    platform: "meta",
    utm_source: "instagram",
    utm_medium: "paid_social",
    utm_campaign: "match_fit_reels",
    funnel: "homepage",
  },
  {
    id: "google_search_client",
    label: "Google — search client",
    platform: "google",
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "client_search_atlanta",
    funnel: "client",
  },
  {
    id: "google_search_trainer",
    label: "Google — search Fitness Pro",
    platform: "google",
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "trainer_search_atlanta",
    funnel: "trainer",
  },
  {
    id: "google_pmax",
    label: "Google — Performance Max",
    platform: "google",
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "pmax_match_fit",
    funnel: "homepage",
  },
  {
    id: "tiktok_paid_social",
    label: "TikTok — paid social",
    platform: "tiktok",
    utm_source: "tiktok",
    utm_medium: "paid_social",
    utm_campaign: "match_fit_tiktok_promote",
    funnel: "homepage",
  },
];

export type BuildTrackedUrlInput = {
  baseUrl: string;
  funnel: AdLandingFunnel;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content?: string;
  utm_term?: string;
};

export function buildTrackedAdUrl(input: BuildTrackedUrlInput): string {
  const landing = AD_LANDING_PATHS[input.funnel];
  const base = input.baseUrl.replace(/\/$/, "");
  const url = new URL(`${base}${landing.path}`);

  url.searchParams.set("utm_source", input.utm_source.trim());
  url.searchParams.set("utm_medium", input.utm_medium.trim());
  url.searchParams.set("utm_campaign", input.utm_campaign.trim());

  const content = input.utm_content?.trim();
  const term = input.utm_term?.trim();
  if (content) url.searchParams.set("utm_content", content);
  if (term) url.searchParams.set("utm_term", term);

  return url.toString();
}

export function googleAdsConversionEnvKey(kind: AdConversionGoal): string {
  return kind === "client_signup"
    ? "NEXT_PUBLIC_GOOGLE_ADS_CLIENT_SIGNUP_CONVERSION_LABEL"
    : "NEXT_PUBLIC_GOOGLE_ADS_TRAINER_SIGNUP_CONVERSION_LABEL";
}

export function metaPixelVerificationSnippet(): string {
  return `<!-- Meta Pixel (already in Match Fit layout) -->
<script>
  fbq('init', '${META_PIXEL_ID}');
  fbq('track', 'PageView');
</script>`;
}

export function googleAdsVerificationSnippet(): string {
  return `<!-- Google tag (already in Match Fit layout) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GOOGLE_ADS_ID}');
</script>`;
}

/** Trainer onboarding wizard steps tracked as MatchFitSignupStep custom events. */
export function trainerOnboardingStepCatalog(): { step_id: string; step_name: string }[] {
  return Object.values(TRAINER_ONBOARDING_FUNNEL_STEPS);
}
