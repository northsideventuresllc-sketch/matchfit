import {
  getTurnstileRuntimeStatus,
  probeTurnstileSecretKey,
} from "@/lib/turnstile-verify";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Public health check for Turnstile configuration (no secrets exposed).
 * Use after setting Vercel env vars and redeploying.
 */
export async function GET() {
  const status = getTurnstileRuntimeStatus();
  const secretProbe = status.serverVerificationEnabled
    ? await probeTurnstileSecretKey()
    : ("missing" as const);

  const healthy =
    status.fullyConfigured &&
    secretProbe === "ok" &&
    status.clientWidgetEnabled;

  let message: string;
  if (healthy) {
    message = "Turnstile is fully configured. Sign-in widgets should appear and tokens are verified server-side.";
  } else if (!status.clientWidgetEnabled && !status.serverVerificationEnabled) {
    message =
      "Turnstile is disabled (no keys). Set NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY in Vercel, then redeploy.";
  } else if (!status.clientWidgetEnabled) {
    message =
      "Server secret is set but NEXT_PUBLIC_TURNSTILE_SITE_KEY is missing from the build. Add it in Vercel and trigger a new production deployment.";
  } else if (!status.serverVerificationEnabled) {
    message =
      "Site key is in the build but TURNSTILE_SECRET_KEY is missing at runtime. Add the secret in Vercel (Production) and redeploy.";
  } else if (secretProbe === "invalid") {
    message =
      "TURNSTILE_SECRET_KEY is set but Cloudflare rejected it. Use the secret that pairs with your Turnstile site key (same widget in Cloudflare dashboard).";
  } else {
    message = "Turnstile configuration is incomplete. Check Vercel environment variables and redeploy.";
  }

  return NextResponse.json({
    healthy,
    ...status,
    secretAcceptedByCloudflare: secretProbe === "ok",
    secretProbe,
    message,
    redeployRequiredForSiteKey:
      !status.clientWidgetEnabled && status.serverVerificationEnabled,
  });
}
