import { encryptUtf8 } from "@/lib/field-encryption";
import { prisma } from "@/lib/prisma";
import {
  createSupabaseServerClientForTrainerZoomOAuth,
  TRAINER_ZOOM_SUPABASE_LINK_COOKIE,
} from "@/lib/supabase/trainer-zoom-oauth";
import { verifyTrainerZoomSupabaseLinkState, verifyVideoOAuthState } from "@/lib/trainer-video-oauth-state";
import {
  stringifyOAuthTokenBundle,
  zoomAccessTokenExpiresAtMs,
  zoomExchangeCode,
  type OAuthTokenBundle,
} from "@/lib/trainer-video-oauth-tokens";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function redirectBack(req: Request, query: string) {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || new URL(req.url).origin;
  return NextResponse.redirect(`${origin}/trainer/dashboard/video-meetings?${query}`);
}

async function zoomAccountHint(accessToken: string): Promise<string | null> {
  try {
    const r = await fetch("https://api.zoom.us/v2/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const j = (await r.json().catch(() => null)) as { email?: string; id?: string } | null;
    if (j?.email && typeof j.email === "string") {
      const [u, d] = j.email.split("@");
      if (u && d) return `${u.slice(0, 2)}…@${d}`;
    } else if (j?.id) {
      return `zoom:${String(j.id).slice(0, 8)}…`;
    }
  } catch {
    /* non-fatal */
  }
  return null;
}

function sessionToZoomBundle(session: {
  provider_token?: string | null;
  provider_refresh_token?: string | null;
}): OAuthTokenBundle | { error: string } {
  const refresh = session.provider_refresh_token;
  const access = session.provider_token;
  if (typeof refresh !== "string" || !refresh.trim()) {
    return {
      error:
        "Zoom did not return a refresh token. In Supabase Dashboard, confirm the Zoom app includes the meeting scopes and try Connect again with consent.",
    };
  }
  const accessStr = typeof access === "string" && access.trim() ? access : undefined;
  return {
    refreshToken: refresh,
    accessToken: accessStr,
    expiresAtMs: zoomAccessTokenExpiresAtMs(accessStr) ?? undefined,
  };
}

async function persistZoomConnection(args: {
  trainerId: string;
  exchanged: OAuthTokenBundle;
  hint: string | null;
  oauthGrantSource: "direct" | "supabase_zoom";
}): Promise<void> {
  await prisma.trainerVideoConferenceConnection.upsert({
    where: { trainerId_provider: { trainerId: args.trainerId, provider: "ZOOM" } },
    create: {
      trainerId: args.trainerId,
      provider: "ZOOM",
      encryptedOAuthBundle: encryptUtf8(stringifyOAuthTokenBundle(args.exchanged)),
      accessTokenExpiresAt: args.exchanged.expiresAtMs ? new Date(args.exchanged.expiresAtMs) : null,
      externalAccountHint: args.hint,
      oauthGrantSource: args.oauthGrantSource,
    },
    update: {
      encryptedOAuthBundle: encryptUtf8(stringifyOAuthTokenBundle(args.exchanged)),
      accessTokenExpiresAt: args.exchanged.expiresAtMs ? new Date(args.exchanged.expiresAtMs) : null,
      externalAccountHint: args.hint ?? undefined,
      oauthGrantSource: args.oauthGrantSource,
      revokedAt: null,
      updatedAt: new Date(),
    },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const oauthErr = url.searchParams.get("error");
  if (oauthErr) {
    return redirectBack(req, `oauthError=${encodeURIComponent(oauthErr)}`);
  }
  const code = url.searchParams.get("code");
  if (!code?.trim()) {
    return redirectBack(req, "oauthError=missing_code");
  }

  const cookieStore = await cookies();
  const linkCookie = cookieStore.get(TRAINER_ZOOM_SUPABASE_LINK_COOKIE)?.value;
  const link = linkCookie ? await verifyTrainerZoomSupabaseLinkState(linkCookie) : null;

  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || new URL(req.url).origin;
  const response = NextResponse.redirect(`${origin}/trainer/dashboard/video-meetings?connected=zoom`);

  if (link) {
    const { supabase, error } = createSupabaseServerClientForTrainerZoomOAuth({
      requestCookies: cookieStore,
      responseCookies: response.cookies,
    });
    if (error || !supabase) {
      return redirectBack(req, "oauthError=supabase_not_configured");
    }

    const { error: xErr } = await supabase.auth.exchangeCodeForSession(code);
    if (xErr) {
      console.error("[trainer oauth zoom callback] exchangeCodeForSession", xErr);
      return redirectBack(req, `oauthError=${encodeURIComponent(xErr.message)}`);
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return redirectBack(req, "oauthError=no_session_after_exchange");
    }

    const bundle = sessionToZoomBundle(session);
    if ("error" in bundle) {
      return redirectBack(req, `oauthError=${encodeURIComponent(bundle.error)}`);
    }

    let hint: string | null = null;
    if (bundle.accessToken) {
      hint = await zoomAccountHint(bundle.accessToken);
    }

    await persistZoomConnection({
      trainerId: link.trainerId,
      exchanged: bundle,
      hint,
      oauthGrantSource: "supabase_zoom",
    });

    await supabase.auth.signOut();
    response.cookies.delete(TRAINER_ZOOM_SUPABASE_LINK_COOKIE);
    return response;
  }

  const state = url.searchParams.get("state");
  if (!state?.trim()) {
    return redirectBack(req, "oauthError=invalid_state");
  }
  const st = await verifyVideoOAuthState(state);
  if (!st || st.provider !== "ZOOM") {
    return redirectBack(req, "oauthError=invalid_state");
  }

  const exchanged = await zoomExchangeCode(code);
  if ("error" in exchanged) {
    return redirectBack(req, `oauthError=${encodeURIComponent(exchanged.error)}`);
  }
  let hint: string | null = null;
  if (exchanged.accessToken) {
    hint = await zoomAccountHint(exchanged.accessToken);
  }
  await persistZoomConnection({
    trainerId: st.trainerId,
    exchanged,
    hint,
    oauthGrantSource: "direct",
  });
  return redirectBack(req, "connected=zoom");
}
