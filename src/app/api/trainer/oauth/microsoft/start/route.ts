import { getSessionTrainerId } from "@/lib/session";
import {
  createSupabaseServerClientForTrainerMicrosoftOAuth,
  TRAINER_MICROSOFT_SUPABASE_LINK_COOKIE,
  TRAINER_MICROSOFT_SUPABASE_OAUTH_SCOPES,
  trainerMicrosoftLinkCookieOptions,
  trainerMicrosoftOAuthCallbackUrl,
} from "@/lib/supabase/trainer-microsoft-oauth";
import { signTrainerMicrosoftSupabaseLinkState } from "@/lib/trainer-video-oauth-state";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const redirectTo = trainerMicrosoftOAuthCallbackUrl();
  if (!redirectTo) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL is required for Microsoft OAuth redirect." },
      { status: 503 },
    );
  }

  const cookieStore = await cookies();
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || new URL(request.url).origin;
  const response = NextResponse.redirect(new URL("/", base).toString(), 302);

  const { supabase, error } = createSupabaseServerClientForTrainerMicrosoftOAuth({
    requestCookies: cookieStore,
    responseCookies: response.cookies,
  });
  if (error || !supabase) {
    return NextResponse.json(
      {
        error:
          "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, enable the Azure provider in Supabase, and add the Microsoft callback URL to redirect allow list.",
      },
      { status: 503 },
    );
  }

  const { data, error: oauthErr } = await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: {
      redirectTo,
      scopes: TRAINER_MICROSOFT_SUPABASE_OAUTH_SCOPES,
      queryParams: { prompt: "consent" },
    },
  });

  if (oauthErr || !data.url) {
    console.error("[trainer oauth microsoft start]", oauthErr);
    return NextResponse.json(
      { error: oauthErr?.message ?? "Could not start Microsoft sign-in." },
      { status: 502 },
    );
  }

  response.headers.set("Location", data.url);
  const linkToken = await signTrainerMicrosoftSupabaseLinkState(trainerId);
  response.cookies.set(
    TRAINER_MICROSOFT_SUPABASE_LINK_COOKIE,
    linkToken,
    trainerMicrosoftLinkCookieOptions(15 * 60),
  );

  return response;
}
