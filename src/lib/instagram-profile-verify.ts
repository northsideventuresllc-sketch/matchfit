import "server-only";

import { parseTrainerSocialUrl } from "@/lib/trainer-social-urls";

const IG_APP_ID = "936619743392459";
const IG_MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

export type InstagramProfileVerification =
  | {
      ok: true;
      username: string;
      profileUrl: string;
      fullName: string | null;
      biography: string | null;
      isPrivate: boolean;
      verifiedVia: "api" | "html";
    }
  | { ok: false; username: string; reason: string };

type WebProfileInfoResponse = {
  data?: {
    user?: {
      username?: string;
      full_name?: string;
      biography?: string;
      is_private?: boolean;
    };
  };
};

/** Normalize @handle or profile URL to canonical Instagram username + profile URL. */
export function normalizeInstagramLeadIdentity(input: {
  handle?: string | null;
  profileUrl?: string | null;
}): { username: string; handle: string; profileUrl: string } | null {
  const rawHandle = input.handle?.trim();
  const rawUrl = input.profileUrl?.trim();
  const candidate = rawHandle || rawUrl;
  if (!candidate) return null;

  const parsed = parseTrainerSocialUrl("instagram", candidate);
  if (!parsed.ok || !parsed.value) return null;

  let username = "";
  try {
    const url = new URL(parsed.value);
    const parts = url.pathname.split("/").filter(Boolean);
    username = (parts[0] ?? "").replace(/^@/, "").toLowerCase();
  } catch {
    return null;
  }

  if (!/^[a-z0-9._]{1,30}$/.test(username)) return null;
  if (["p", "reel", "reels", "stories", "explore", "accounts"].includes(username)) return null;

  const profileUrl = `https://www.instagram.com/${encodeURIComponent(username)}/`;
  return { username, handle: `@${username}`, profileUrl };
}

function extractProfileFieldsFromHtml(html: string, username: string): {
  fullName: string | null;
  biography: string | null;
  isPrivate: boolean;
} {
  const fullNameMatch = html.match(/"full_name":"((?:\\.|[^"\\])*)"/);
  const biographyMatch = html.match(/"biography":"((?:\\.|[^"\\])*)"/);
  const isPrivateMatch = html.match(/"is_private":(true|false)/);

  const unescape = (value: string | undefined) =>
    value?.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/\\n/g, "\n") ??
    null;

  return {
    fullName: unescape(fullNameMatch?.[1])?.trim() || null,
    biography: unescape(biographyMatch?.[1])?.trim() || null,
    isPrivate: isPrivateMatch?.[1] === "true",
  };
}

/** Fallback when Instagram JSON API is blocked from server IPs. */
async function verifyInstagramProfileViaHtml(username: string): Promise<InstagramProfileVerification | null> {
  const normalized = username.trim().replace(/^@/, "").toLowerCase();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch(`https://www.instagram.com/${encodeURIComponent(normalized)}/`, {
      method: "GET",
      headers: {
        "User-Agent": IG_MOBILE_UA,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
    });

    const html = await res.text();
    const unavailable =
      html.includes("Sorry, this page isn't available") ||
      html.includes("Page Not Found") ||
      html.includes("The link you followed may be broken");

    if (unavailable || res.status === 404) {
      return { ok: false, username: normalized, reason: "Instagram profile not found." };
    }

    const hasProfileMarker =
      html.includes(`"username":"${normalized}"`) ||
      html.includes(`instagram.com/${normalized}`) ||
      html.includes('"profilePage_"');

    if (!res.ok || !hasProfileMarker) {
      return null;
    }

    const fields = extractProfileFieldsFromHtml(html, normalized);
    return {
      ok: true,
      username: normalized,
      profileUrl: `https://www.instagram.com/${encodeURIComponent(normalized)}/`,
      fullName: fields.fullName,
      biography: fields.biography,
      isPrivate: fields.isPrivate,
      verifiedVia: "html",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Confirms an Instagram username resolves to a live public profile page. */
export async function verifyInstagramProfile(username: string): Promise<InstagramProfileVerification> {
  const normalized = username.trim().replace(/^@/, "").toLowerCase();
  if (!normalized) {
    return { ok: false, username: normalized, reason: "Missing username." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(normalized)}`,
      {
        method: "GET",
        headers: {
          "User-Agent": IG_MOBILE_UA,
          Accept: "application/json",
          "X-IG-App-ID": IG_APP_ID,
          Referer: `https://www.instagram.com/${encodeURIComponent(normalized)}/`,
        },
        signal: controller.signal,
        cache: "no-store",
      },
    );

    if (res.status === 404) {
      return { ok: false, username: normalized, reason: "Instagram profile not found." };
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok || !contentType.includes("application/json")) {
      const htmlFallback = await verifyInstagramProfileViaHtml(normalized);
      if (htmlFallback) return htmlFallback;
      return {
        ok: false,
        username: normalized,
        reason: `Instagram verification unavailable (HTTP ${res.status}).`,
      };
    }

    const data = (await res.json()) as WebProfileInfoResponse;
    const user = data.data?.user;
    const resolved = user?.username?.trim().toLowerCase();
    if (!resolved) {
      const htmlFallback = await verifyInstagramProfileViaHtml(normalized);
      if (htmlFallback) return htmlFallback;
      return { ok: false, username: normalized, reason: "Instagram profile not found." };
    }

    return {
      ok: true,
      username: resolved,
      profileUrl: `https://www.instagram.com/${encodeURIComponent(resolved)}/`,
      fullName: user?.full_name?.trim() || null,
      biography: user?.biography?.trim() || null,
      isPrivate: Boolean(user?.is_private),
      verifiedVia: "api",
    };
  } catch (e) {
    const htmlFallback = await verifyInstagramProfileViaHtml(normalized);
    if (htmlFallback) return htmlFallback;

    const reason =
      e instanceof Error && e.name === "AbortError"
        ? "Instagram verification timed out."
        : "Instagram verification failed.";
    return { ok: false, username: normalized, reason };
  } finally {
    clearTimeout(timeout);
  }
}

export function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}
