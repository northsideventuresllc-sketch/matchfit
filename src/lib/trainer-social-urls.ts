/** Normalize and validate trainer social URLs so each field only accepts its platform. */

export type TrainerSocialPlatform = "instagram" | "tiktok" | "facebook" | "linkedin" | "other";

const MAX_SOCIAL_LEN = 2048;

function isBlank(s: string): boolean {
  return s.trim() === "";
}

function withHttps(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function safeParseUrl(raw: string): URL | null {
  try {
    return new URL(withHttps(raw));
  } catch {
    return null;
  }
}

function hostnameOk(hostname: string, allowed: (h: string) => boolean): boolean {
  return allowed(hostname.toLowerCase());
}

function isInstagramHost(h: string): boolean {
  return h === "instagram.com" || h.endsWith(".instagram.com");
}

function isTikTokHost(h: string): boolean {
  return h === "tiktok.com" || h.endsWith(".tiktok.com");
}

function isFacebookHost(h: string): boolean {
  return (
    h === "facebook.com" ||
    h.endsWith(".facebook.com") ||
    h === "fb.com" ||
    h === "www.fb.com" ||
    h.endsWith(".fb.com")
  );
}

function isLinkedInHost(h: string): boolean {
  return h === "linkedin.com" || h.endsWith(".linkedin.com");
}

function isReservedSocialHost(h: string): boolean {
  return isInstagramHost(h) || isTikTokHost(h) || isFacebookHost(h) || isLinkedInHost(h);
}

/** Handle-only: letters, numbers, periods, underscores (Instagram username rules, conservative). */
const HANDLE_ONLY = /^@?([A-Za-z0-9._]{1,64})$/;

/**
 * Returns normalized URL string for storage, or `null` if empty.
 * On failure returns `{ ok: false, error }`.
 */
export function parseTrainerSocialUrl(
  platform: TrainerSocialPlatform,
  raw: string,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const s = raw.trim();
  if (isBlank(s)) {
    return { ok: true, value: null };
  }
  if (s.length > MAX_SOCIAL_LEN) {
    return { ok: false, error: "That link is too long." };
  }

  if (platform === "instagram") {
    if (HANDLE_ONLY.test(s)) {
      const handle = s.replace(/^@/, "").replace(/\.$/, "");
      return { ok: true, value: `https://www.instagram.com/${encodeURIComponent(handle)}/` };
    }
    const u = safeParseUrl(s);
    if (!u || u.protocol !== "https:" && u.protocol !== "http:") {
      return { ok: false, error: "Enter a valid Instagram URL (instagram.com/…) or your @username." };
    }
    if (!hostnameOk(u.hostname, isInstagramHost)) {
      return { ok: false, error: "That URL is not an Instagram link. Use instagram.com or your @handle." };
    }
    u.protocol = "https:";
    return { ok: true, value: u.toString() };
  }

  if (platform === "tiktok") {
    if (HANDLE_ONLY.test(s)) {
      const handle = s.replace(/^@/, "").replace(/\.$/, "");
      return { ok: true, value: `https://www.tiktok.com/@${encodeURIComponent(handle)}` };
    }
    const u = safeParseUrl(s);
    if (!u || (u.protocol !== "https:" && u.protocol !== "http:")) {
      return { ok: false, error: "Enter a valid TikTok URL (tiktok.com/…) or your @handle." };
    }
    if (!hostnameOk(u.hostname, isTikTokHost)) {
      return { ok: false, error: "That URL is not a TikTok link. Use tiktok.com or your @handle." };
    }
    u.protocol = "https:";
    return { ok: true, value: u.toString() };
  }

  if (platform === "facebook") {
    const u = safeParseUrl(s);
    if (!u || (u.protocol !== "https:" && u.protocol !== "http:")) {
      return {
        ok: false,
        error: "Enter your full Facebook profile URL (for example https://www.facebook.com/your.name).",
      };
    }
    if (!hostnameOk(u.hostname, isFacebookHost)) {
      return { ok: false, error: "That URL is not a Facebook link. Use facebook.com or fb.com." };
    }
    u.protocol = "https:";
    return { ok: true, value: u.toString() };
  }

  if (platform === "linkedin") {
    const u = safeParseUrl(s);
    if (!u || (u.protocol !== "https:" && u.protocol !== "http:")) {
      return {
        ok: false,
        error: "Enter your full LinkedIn profile URL (for example https://www.linkedin.com/in/your-profile).",
      };
    }
    if (!hostnameOk(u.hostname, isLinkedInHost)) {
      return { ok: false, error: "That URL is not a LinkedIn link. Use linkedin.com." };
    }
    u.protocol = "https:";
    return { ok: true, value: u.toString() };
  }

  // other — any https URL except the four platforms above
  const u = safeParseUrl(s);
  if (!u || u.protocol !== "https:") {
    return { ok: false, error: "Use a full https:// link (for example your website or Linktree)." };
  }
  if (isReservedSocialHost(u.hostname)) {
    return {
      ok: false,
      error: "Use the Instagram, TikTok, Facebook, or LinkedIn fields above for those profiles.",
    };
  }
  return { ok: true, value: u.toString() };
}

export type TrainerSocialInputs = {
  socialInstagram: string;
  socialTiktok: string;
  socialFacebook: string;
  socialLinkedin: string;
  socialOtherUrl: string;
};

export type TrainerSocialNormalized = {
  socialInstagram: string | null;
  socialTiktok: string | null;
  socialFacebook: string | null;
  socialLinkedin: string | null;
  socialOtherUrl: string | null;
};

export function normalizeTrainerSocialFields(
  input: TrainerSocialInputs,
): { ok: true; value: TrainerSocialNormalized } | { ok: false; error: string; field: keyof TrainerSocialInputs } {
  const fields: { key: keyof TrainerSocialInputs; platform: TrainerSocialPlatform }[] = [
    { key: "socialInstagram", platform: "instagram" },
    { key: "socialTiktok", platform: "tiktok" },
    { key: "socialFacebook", platform: "facebook" },
    { key: "socialLinkedin", platform: "linkedin" },
    { key: "socialOtherUrl", platform: "other" },
  ];

  const out: TrainerSocialNormalized = {
    socialInstagram: null,
    socialTiktok: null,
    socialFacebook: null,
    socialLinkedin: null,
    socialOtherUrl: null,
  };

  for (const { key, platform } of fields) {
    const r = parseTrainerSocialUrl(platform, input[key]);
    if (!r.ok) {
      return { ok: false, error: r.error, field: key };
    }
    out[key] = r.value;
  }

  return { ok: true, value: out };
}
