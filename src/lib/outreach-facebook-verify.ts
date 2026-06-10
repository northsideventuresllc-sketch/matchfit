import "server-only";

export function normalizeFacebookPageUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (!host.endsWith("facebook.com") && host !== "fb.com") return null;

    const path = parsed.pathname.replace(/\/+$/, "");
    if (!path || path === "/") return null;

    const blocked = ["/login", "/watch", "/marketplace", "/gaming"];
    if (blocked.some((prefix) => path.startsWith(prefix))) return null;

    return `https://www.facebook.com${path}/`;
  } catch {
    return null;
  }
}

export async function verifyFacebookPageUrl(
  url: string,
): Promise<
  | { ok: true; pageUrl: string; verifiedLive: boolean }
  | { ok: false; reason: string }
> {
  const normalized = normalizeFacebookPageUrl(url);
  if (!normalized) {
    return { ok: false, reason: "Invalid Facebook page or group URL." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch(normalized, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MatchFitOutreach/1.0; +https://match-fit.net)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
    });

    if (res.status === 404) {
      return { ok: false, reason: "Facebook page or group not found." };
    }

    const html = (await res.text()).slice(0, 250_000);
    const unavailable =
      html.includes("This content isn't available") ||
      html.includes("Page Not Found") ||
      html.includes("The link you followed may be broken");

    if (unavailable) {
      return { ok: false, reason: "Facebook page or group not available." };
    }

    if (!res.ok && res.status >= 400) {
      return { ok: true, pageUrl: normalized, verifiedLive: false };
    }

    return { ok: true, pageUrl: normalized, verifiedLive: true };
  } catch {
    return { ok: true, pageUrl: normalized, verifiedLive: false };
  } finally {
    clearTimeout(timeout);
  }
}
