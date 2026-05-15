import { createServerClient } from "@supabase/ssr";
import { TRAINER_ZOOM_SUPABASE_OAUTH_SCOPES } from "@/lib/trainer-video-oauth-tokens";

/** Correlates Supabase Zoom OAuth return with the Match Fit trainer session (PKCE verifier lives in Supabase cookies). */
export const TRAINER_ZOOM_SUPABASE_LINK_COOKIE = "mf_trainer_zoom_supabase_oauth_link";

export { TRAINER_ZOOM_SUPABASE_OAUTH_SCOPES };

/** Must match Supabase Dashboard → Authentication → URL configuration (redirect allow list). */
export function trainerZoomOAuthCallbackUrl(): string | null {
  const b = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  return b ? `${b}/api/trainer/oauth/zoom/callback` : null;
}

export function trainerZoomLinkCookieOptions(maxAgeSec: number) {
  const secure =
    process.env.MATCH_FIT_COOKIE_SECURE?.trim().toLowerCase() === "0" ||
    process.env.MATCH_FIT_COOKIE_SECURE?.trim().toLowerCase() === "false"
      ? false
      : process.env.NODE_ENV === "production";
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: maxAgeSec,
  };
}

type CookieStoreLike = {
  getAll(): { name: string; value: string }[];
};

type ResponseCookiesLike = {
  set(name: string, value: string, options?: Record<string, unknown>): void;
};

export function createSupabaseServerClientForTrainerZoomOAuth(args: {
  requestCookies: CookieStoreLike;
  responseCookies: ResponseCookiesLike;
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    return { supabase: null, error: "Supabase is not configured." };
  }
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return args.requestCookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          args.responseCookies.set(name, value, options);
        }
      },
    },
  });
  return { supabase, error: null };
}
