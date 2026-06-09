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

/** Confirms an Instagram username resolves to a live public profile page. */
export async function verifyInstagramProfile(username: string): Promise<InstagramProfileVerification> {
  const normalized = username.trim().replace(/^@/, "").toLowerCase();
  if (!normalized) {
    return { ok: false, username: normalized, reason: "Missing username." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(normalized)}`,
      {
        method: "GET",
        headers: {
          "User-Agent": IG_MOBILE_UA,
          Accept: "application/json",
          "X-IG-App-ID": IG_APP_ID,
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
      return { ok: false, username: normalized, reason: "Instagram profile not found." };
    }

    return {
      ok: true,
      username: resolved,
      profileUrl: `https://www.instagram.com/${encodeURIComponent(resolved)}/`,
      fullName: user?.full_name?.trim() || null,
      biography: user?.biography?.trim() || null,
      isPrivate: Boolean(user?.is_private),
    };
  } catch (e) {
    const reason = e instanceof Error && e.name === "AbortError" ? "Instagram verification timed out." : "Instagram verification failed.";
    return { ok: false, username: normalized, reason };
  } finally {
    clearTimeout(timeout);
  }
}

export function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
