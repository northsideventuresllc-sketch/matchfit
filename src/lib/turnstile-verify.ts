import {
  getTurnstileSecretKey,
  isTurnstileClientEnabled,
  isTurnstileDummyKeyPair,
  isTurnstileFullyConfigured,
  isTurnstileStrictMode,
  isTurnstileServerVerificationEnabled,
} from "@/lib/turnstile-config";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type SiteverifyJson = {
  success?: boolean;
  "error-codes"?: string[];
};

export type TurnstileSecretProbe = "missing" | "invalid" | "ok";

function clientIpFromRequest(req: Request): string | undefined {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim();
  return undefined;
}

/** Calls siteverify with a dummy token to confirm the secret key is accepted by Cloudflare. */
export async function probeTurnstileSecretKey(): Promise<TurnstileSecretProbe> {
  const secret = getTurnstileSecretKey();
  if (!secret) return "missing";
  if (isTurnstileDummyKeyPair()) return "ok";

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", "match-fit-turnstile-probe");

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as SiteverifyJson;
    const codes = data["error-codes"] ?? [];
    if (codes.includes("invalid-secret")) return "invalid";
    // invalid-input-response / missing-input-response => secret recognized
    return "ok";
  } catch {
    return "invalid";
  }
}

/**
 * Verifies a Turnstile widget token from sign-in or sign-up.
 *
 * - Fully configured (site + secret) → token required; verified with Cloudflare.
 * - Site key only, no secret → skipped unless `MATCH_FIT_TURNSTILE_STRICT=1`.
 * - Neither key → skipped (local dev).
 */
export async function verifyTurnstileToken(
  token: string | undefined,
  req?: Request,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const secret = getTurnstileSecretKey();
  const siteKey = isTurnstileClientEnabled();

  if (!secret) {
    if (siteKey && isTurnstileStrictMode()) {
      console.error(
        "[Turnstile] NEXT_PUBLIC_TURNSTILE_SITE_KEY is set but TURNSTILE_SECRET_KEY is missing (strict mode).",
      );
      return {
        ok: false,
        error:
          "Sign-in security is not fully configured yet. Add TURNSTILE_SECRET_KEY in Vercel (Turnstile secret for this site), then redeploy.",
        status: 503,
      };
    }
    if (siteKey) {
      console.warn(
        "[Turnstile] Site key is set but TURNSTILE_SECRET_KEY is missing — skipping server verification. Add the secret and redeploy.",
      );
    }
    return { ok: true };
  }

  if (!siteKey) {
    console.warn(
      "[Turnstile] TURNSTILE_SECRET_KEY is set but NEXT_PUBLIC_TURNSTILE_SITE_KEY is missing — widgets will not render until you set the public key and redeploy.",
    );
  }

  if (!token?.trim()) {
    return {
      ok: false,
      error: "Complete the security check before continuing.",
      status: 400,
    };
  }

  if (isTurnstileDummyKeyPair()) {
    return { ok: true };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token.trim());
  if (req) {
    const ip = clientIpFromRequest(req);
    if (ip) body.set("remoteip", ip);
  }

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as SiteverifyJson;
    if (data.success) return { ok: true };
    const codes = data["error-codes"]?.join(", ") ?? "unknown";
    console.warn("[Turnstile] siteverify failed:", codes);
    return {
      ok: false,
      error: "Security verification failed. Refresh the page and try again.",
      status: 400,
    };
  } catch (e) {
    console.error("[Turnstile] siteverify request error", e);
    return {
      ok: false,
      error: "Security verification could not be completed. Try again.",
      status: 503,
    };
  }
}

export function getTurnstileRuntimeStatus(): {
  clientWidgetEnabled: boolean;
  serverVerificationEnabled: boolean;
  fullyConfigured: boolean;
  strictMode: boolean;
  usingDummyKeys: boolean;
} {
  return {
    clientWidgetEnabled: isTurnstileClientEnabled(),
    serverVerificationEnabled: isTurnstileServerVerificationEnabled(),
    fullyConfigured: isTurnstileFullyConfigured(),
    strictMode: isTurnstileStrictMode(),
    usingDummyKeys: isTurnstileDummyKeyPair(),
  };
}
