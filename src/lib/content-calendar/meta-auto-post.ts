import "server-only";

import { readPlatformSecret } from "@/lib/platform-secrets";

const GRAPH = "https://graph.facebook.com/v21.0";

/** Match Fit owned surfaces. */
export const MATCH_FIT_FB_PAGE_ID = "1162533296938793";
export const MATCH_FIT_IG_USER_ID = "17841430729274532";

/**
 * Permissions the Meta token must carry before anything can be published.
 * The token today has ads/read scopes only, so publishing is impossible until
 * JB re-authorises the app — we detect that up front and say so in plain
 * English instead of failing halfway through a post.
 */
const REQUIRED_SCOPES = {
  facebook: ["pages_manage_posts"],
  instagram: ["instagram_basic", "instagram_content_publish"],
} as const;

export type AutoPostTarget = "facebook" | "instagram";

export type AutoPostResult = {
  target: AutoPostTarget;
  ok: boolean;
  id?: string;
  error?: string;
};

async function metaToken(): Promise<string | null> {
  const token = await readPlatformSecret("META_ACCESS_TOKEN");
  return token?.trim() || null;
}

export async function getTokenScopes(token: string): Promise<string[]> {
  const r = await fetch(
    `${GRAPH}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`,
  );
  if (!r.ok) return [];
  const data = (await r.json()) as { data?: { scopes?: string[] } };
  return data.data?.scopes ?? [];
}

export function missingScopesFor(target: AutoPostTarget, scopes: string[]): string[] {
  return REQUIRED_SCOPES[target].filter((s) => !scopes.includes(s));
}

/** Plain-English blocker message — never raw scope jargon on its own. */
export function scopeBlockerMessage(missing: string[]): string {
  return [
    "Auto-posting is not switched on yet.",
    "The Match Fit Meta app has not been given permission to publish — only to read ads data.",
    `Missing permissions: ${missing.join(", ")}.`,
    "Fix: open the Meta app settings, add those permissions, and re-authorise. Nothing else about this is broken.",
  ].join(" ");
}

async function postToFacebook(
  token: string,
  message: string,
  imageUrl?: string,
): Promise<AutoPostResult> {
  const endpoint = imageUrl
    ? `${GRAPH}/${MATCH_FIT_FB_PAGE_ID}/photos`
    : `${GRAPH}/${MATCH_FIT_FB_PAGE_ID}/feed`;
  const body = imageUrl
    ? { url: imageUrl, caption: message, access_token: token }
    : { message, access_token: token };

  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await r.json()) as { id?: string; post_id?: string; error?: { message?: string } };
  if (!r.ok || data.error) {
    return { target: "facebook", ok: false, error: data.error?.message ?? `HTTP ${r.status}` };
  }
  return { target: "facebook", ok: true, id: data.post_id ?? data.id };
}

async function postToInstagram(
  token: string,
  caption: string,
  imageUrl: string,
): Promise<AutoPostResult> {
  const createRes = await fetch(`${GRAPH}/${MATCH_FIT_IG_USER_ID}/media`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: token }),
  });
  const created = (await createRes.json()) as { id?: string; error?: { message?: string } };
  if (!createRes.ok || !created.id) {
    return {
      target: "instagram",
      ok: false,
      error: created.error?.message ?? `HTTP ${createRes.status}`,
    };
  }

  const publishRes = await fetch(`${GRAPH}/${MATCH_FIT_IG_USER_ID}/media_publish`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ creation_id: created.id, access_token: token }),
  });
  const published = (await publishRes.json()) as { id?: string; error?: { message?: string } };
  if (!publishRes.ok || !published.id) {
    return {
      target: "instagram",
      ok: false,
      error: published.error?.message ?? `HTTP ${publishRes.status}`,
    };
  }
  return { target: "instagram", ok: true, id: published.id };
}

/**
 * Publish one approved post to the requested Match Fit surfaces.
 * Returns per-target results; a permission problem is reported once, clearly,
 * rather than as an error per platform.
 */
export async function autoPost(args: {
  caption: string;
  imageUrl?: string;
  targets: AutoPostTarget[];
}): Promise<{ ok: boolean; blocked?: string; results: AutoPostResult[] }> {
  const token = await metaToken();
  if (!token) {
    return {
      ok: false,
      blocked: "Auto-posting is not connected: no Meta access token is saved.",
      results: [],
    };
  }

  const scopes = await getTokenScopes(token);
  const missing = [...new Set(args.targets.flatMap((t) => missingScopesFor(t, scopes)))];
  if (missing.length) {
    return { ok: false, blocked: scopeBlockerMessage(missing), results: [] };
  }

  const results: AutoPostResult[] = [];
  for (const target of args.targets) {
    if (target === "instagram") {
      if (!args.imageUrl) {
        results.push({
          target,
          ok: false,
          error: "Instagram needs an image — a text-only post cannot be published there.",
        });
        continue;
      }
      results.push(await postToInstagram(token, args.caption, args.imageUrl));
    } else {
      results.push(await postToFacebook(token, args.caption, args.imageUrl));
    }
  }

  return { ok: results.every((r) => r.ok), results };
}
