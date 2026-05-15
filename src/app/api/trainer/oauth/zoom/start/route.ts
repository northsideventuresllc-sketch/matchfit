import { getSessionTrainerId } from "@/lib/session";
import {
  createSupabaseServerClientForTrainerZoomOAuth,
  TRAINER_ZOOM_SUPABASE_LINK_COOKIE,
  TRAINER_ZOOM_SUPABASE_OAUTH_SCOPES,
  trainerZoomLinkCookieOptions,
  trainerZoomOAuthCallbackUrl,
} from "@/lib/supabase/trainer-zoom-oauth";
import { signTrainerZoomSupabaseLinkState, signVideoOAuthState } from "@/lib/trainer-video-oauth-state";
import { zoomAuthorizeUrl } from "@/lib/trainer-video-oauth-tokens";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const redirectTo = trainerZoomOAuthCallbackUrl();
  if (!redirectTo) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL is required for Zoom OAuth redirect." },
      { status: 503 },
    );
  }

  const cookieStore = await cookies();
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || new URL(request.url).origin;
  const response = NextResponse.redirect(new URL("/", base).toString(), 302);

  const { supabase, error } = createSupabaseServerClientForTrainerZoomOAuth({
    requestCookies: cookieStore,
    responseCookies: response.cookies,
  });

  if (!error && supabase) {
    const { data, error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: "zoom",
      options: {
        redirectTo,
        scopes: TRAINER_ZOOM_SUPABASE_OAUTH_SCOPES,
      },
    });

    if (!oauthErr && data.url) {
      response.headers.set("Location", data.url);
      const linkToken = await signTrainerZoomSupabaseLinkState(trainerId);
      response.cookies.set(
        TRAINER_ZOOM_SUPABASE_LINK_COOKIE,
        linkToken,
        trainerZoomLinkCookieOptions(15 * 60),
      );
      return response;
    }
    console.error("[trainer oauth zoom start] supabase", oauthErr);
  }

  const state = await signVideoOAuthState({ trainerId, provider: "ZOOM" });
  const url = zoomAuthorizeUrl(state);
  if (!url) {
    return NextResponse.json(
      {
        error:
          "Zoom OAuth could not start. Enable the Zoom provider in Supabase (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY), or set ZOOM_OAUTH_CLIENT_ID / ZOOM_OAUTH_CLIENT_SECRET for legacy direct OAuth.",
      },
      { status: 503 },
    );
  }
  return NextResponse.redirect(url);
}
