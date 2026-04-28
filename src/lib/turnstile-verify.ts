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

/**
 * Verifies a Turnstile widget token from sign-in or sign-up.
 * In production, `TURNSTILE_SECRET_KEY` must be set or all checks fail closed.
 * In non-production, missing configuration skips verification so local work does not require keys.
 */
export async function verifyTurnstileToken(
  token: string | undefined,
  req?: Request,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Turnstile] TURNSTILE_SECRET_KEY is required in production.");
      return {
        ok: false,
        error: "Account access is temporarily unavailable. Please try again later.",
        status: 503,
      };
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
