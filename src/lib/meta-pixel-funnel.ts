/** Signup funnel identifiers for Meta custom events and ViewContent grouping. */
export type SignupFunnel = "client" | "trainer";

export type MetaFunnelStep = {
  funnel: SignupFunnel;
  step_id: string;
  step_name: string;
  step_index?: number;
};

export const TRAINER_ONBOARDING_FUNNEL_STEPS: Record<number, { step_id: string; step_name: string }> = {
  1: { step_id: "onboarding_acknowledgements", step_name: "Acknowledgements" },
  2: { step_id: "onboarding_background_screening", step_name: "Background Screening" },
  3: { step_id: "onboarding_professional_path", step_name: "Your Professional Path" },
  4: { step_id: "onboarding_certifications", step_name: "Certifications" },
  5: { step_id: "onboarding_w9", step_name: "Tax Information (Form W-9)" },
  6: { step_id: "onboarding_profile_setup", step_name: "Profile Setup" },
};

function normalizePath(pathname: string): string {
  const base = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return base.split("?")[0]?.split("#")[0] ?? base;
}

/** Maps public routes to signup funnel steps (URL-visible progress). */
export function resolveSignupFunnelFromPath(pathname: string): MetaFunnelStep | null {
  const path = normalizePath(pathname);

  const clientRoutes: Record<string, MetaFunnelStep> = {
    "/waitlist/client": {
      funnel: "client",
      step_id: "waitlist",
      step_name: "Client waitlist",
      step_index: 0,
    },
    "/client/sign-up": {
      funnel: "client",
      step_id: "sign_up_page",
      step_name: "Sign-up page",
      step_index: 1,
    },
    "/client/sign-up/complete": {
      funnel: "client",
      step_id: "email_verified",
      step_name: "Email verified",
      step_index: 2,
    },
    "/client/subscribe": {
      funnel: "client",
      step_id: "subscription_offer",
      step_name: "Subscription offer",
      step_index: 3,
    },
    "/client/subscribe/return": {
      funnel: "client",
      step_id: "subscription_checkout_return",
      step_name: "Checkout return",
      step_index: 4,
    },
  };

  const trainerRoutes: Record<string, MetaFunnelStep> = {
    "/waitlist/trainer": {
      funnel: "trainer",
      step_id: "waitlist",
      step_name: "Trainer waitlist",
      step_index: 0,
    },
    "/trainer/signup": {
      funnel: "trainer",
      step_id: "sign_up_page",
      step_name: "Sign-up page",
      step_index: 1,
    },
    "/trainer/sign-up": {
      funnel: "trainer",
      step_id: "sign_up_page",
      step_name: "Sign-up page",
      step_index: 1,
    },
    "/trainer/signup/complete": {
      funnel: "trainer",
      step_id: "sign_up_email_complete",
      step_name: "Email verification complete",
      step_index: 2,
    },
    "/trainer/onboarding": {
      funnel: "trainer",
      step_id: "onboarding",
      step_name: "Onboarding",
      step_index: 3,
    },
  };

  return clientRoutes[path] ?? trainerRoutes[path] ?? null;
}

/** Custom + standard Meta events for signup funnel analytics in Ads Manager. */
export function trackMetaSignupFunnelStep(step: MetaFunnelStep): void {
  if (typeof window === "undefined") return;

  window.fbq?.("trackCustom", "MatchFitSignupStep", {
    funnel: step.funnel,
    step_id: step.step_id,
    step_name: step.step_name,
    ...(step.step_index != null ? { step_index: step.step_index } : {}),
  });

  window.fbq?.("track", "ViewContent", {
    content_category: `signup_${step.funnel}`,
    content_name: step.step_id,
    content_ids: [step.step_id],
  });
}

/** Every page load / SPA navigation — general site traffic + path for breakdowns. */
export function trackMetaSiteVisit(pathname: string): void {
  if (typeof window === "undefined") return;

  const page_path = normalizePath(pathname);

  window.fbq?.("track", "PageView", { page_path });
  window.fbq?.("trackCustom", "MatchFitSiteVisit", { page_path });
}

/** Profile created and awaiting payment (client) or equivalent interest signal. */
export function trackMetaLead(funnel: SignupFunnel): void {
  if (typeof window === "undefined") return;

  window.fbq?.("track", "Lead", {
    content_category: `signup_${funnel}`,
    content_name: `${funnel}_registration`,
  });
}

/** Stripe checkout session started for client subscription. */
export function trackMetaInitiateCheckout(funnel: SignupFunnel = "client"): void {
  if (typeof window === "undefined") return;

  window.fbq?.("track", "InitiateCheckout", {
    content_category: `signup_${funnel}`,
    content_name: `${funnel}_subscription_checkout`,
  });
}
