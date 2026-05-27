const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type SiteverifyJson = {
  success?: boolean;
  "error-codes"?: string[];
};

function clientIpFromRequest(req: Request): string | undefined {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim();
  return undefined;
}

function turnstileSiteKeyConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());
}

function turnstileStrictMode(): boolean {
  const v = process.env.MATCH_FIT_TURNSTILE_STRICT?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Verifies a Turnstile widget token from sign-in or sign-up.
 *
 * - No site key and no secret → verification skipped (local / unset env).
 * - Site key without secret → skipped by default so sign-in is not fully blocked by a
 *   half-configured deployment; set `MATCH_FIT_TURNSTILE_STRICT=1` to fail closed instead.
 * - Secret present → token required and verified with Cloudflare.
 */
export async function verifyTurnstileToken(
  token: string | undefined,
  req?: Request,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const siteKey = turnstileSiteKeyConfigured();

  if (!secret) {
    if (siteKey && turnstileStrictMode()) {
      console.error(
        "[Turnstile] NEXT_PUBLIC_TURNSTILE_SITE_KEY is set but TURNSTILE_SECRET_KEY is missing (strict mode).",
      );
      return {
        ok: false,
        error:
          "Sign-in security is not fully configured yet. Add TURNSTILE_SECRET_KEY in Vercel (Turnstile secret for this site), or contact support@match-fit.net.",
        status: 503,
      };
    }
    if (siteKey) {
      console.warn(
        "[Turnstile] Site key is set but TURNSTILE_SECRET_KEY is missing — skipping server verification. Set the secret key and MATCH_FIT_TURNSTILE_STRICT=1 for full protection.",
      );
    }
    return { ok: true };
  }

  if (!token?.trim()) {
    return {
      ok: false,
      error: "Complete the security check before continuing.",
      status: 400,
    };
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
