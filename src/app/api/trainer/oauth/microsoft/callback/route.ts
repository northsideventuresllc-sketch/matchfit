import { encryptUtf8 } from "@/lib/field-encryption";
import { prisma } from "@/lib/prisma";
import {
  createSupabaseServerClientForTrainerMicrosoftOAuth,
  TRAINER_MICROSOFT_SUPABASE_LINK_COOKIE,
} from "@/lib/supabase/trainer-microsoft-oauth";
import { verifyTrainerMicrosoftSupabaseLinkState, verifyVideoOAuthState } from "@/lib/trainer-video-oauth-state";
import {
  microsoftAccessTokenExpiresAtMs,
  microsoftExchangeCode,
  stringifyOAuthTokenBundle,
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

async function graphAccountHint(accessToken: string): Promise<string | null> {
  try {
    const r = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const j = (await r.json().catch(() => null)) as { mail?: string; userPrincipalName?: string } | null;
    const email = j?.mail || j?.userPrincipalName;
    if (email && typeof email === "string") {
      const [u, d] = email.split("@");
      if (u && d) return `${u.slice(0, 2)}…@${d}`;
    }
  } catch {
    /* non-fatal */
  }
  return null;
}

function sessionToMicrosoftBundle(session: {
  provider_token?: string | null;
  provider_refresh_token?: string | null;
}): OAuthTokenBundle | { error: string } {
  const refresh = session.provider_refresh_token;
  const access = session.provider_token;
  if (typeof refresh !== "string" || !refresh.trim()) {
    return {
      error:
        "Microsoft did not return a refresh token. In Supabase Dashboard, confirm the Azure app requests offline_access (same scopes as this app) and try Connect again with consent.",
    };
  }
  const accessStr = typeof access === "string" && access.trim() ? access : undefined;
  return {
    refreshToken: refresh,
    accessToken: accessStr,
    expiresAtMs: microsoftAccessTokenExpiresAtMs(accessStr) ?? undefined,
  };
}

async function persistMicrosoftConnection(args: {
  trainerId: string;
  exchanged: OAuthTokenBundle;
  hint: string | null;
  oauthGrantSource: "direct" | "supabase_azure";
}): Promise<void> {
  await prisma.trainerVideoConferenceConnection.upsert({
    where: { trainerId_provider: { trainerId: args.trainerId, provider: "MICROSOFT" } },
    create: {
      trainerId: args.trainerId,
      provider: "MICROSOFT",
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
  const linkCookie = cookieStore.get(TRAINER_MICROSOFT_SUPABASE_LINK_COOKIE)?.value;
  const link = linkCookie ? await verifyTrainerMicrosoftSupabaseLinkState(linkCookie) : null;

  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || new URL(req.url).origin;
  const response = NextResponse.redirect(`${origin}/trainer/dashboard/video-meetings?connected=microsoft`);

  if (link) {
    const { supabase, error } = createSupabaseServerClientForTrainerMicrosoftOAuth({
      requestCookies: cookieStore,
      responseCookies: response.cookies,
    });
    if (error || !supabase) {
      return redirectBack(req, "oauthError=supabase_not_configured");
    }

    const { error: xErr } = await supabase.auth.exchangeCodeForSession(code);
    if (xErr) {
      console.error("[trainer oauth microsoft callback] exchangeCodeForSession", xErr);
      return redirectBack(req, `oauthError=${encodeURIComponent(xErr.message)}`);
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return redirectBack(req, "oauthError=no_session_after_exchange");
    }

    const bundle = sessionToMicrosoftBundle(session);
    if ("error" in bundle) {
      return redirectBack(req, `oauthError=${encodeURIComponent(bundle.error)}`);
    }

    let hint: string | null = null;
    if (bundle.accessToken) {
      hint = await graphAccountHint(bundle.accessToken);
    }

    await persistMicrosoftConnection({
      trainerId: link.trainerId,
      exchanged: bundle,
      hint,
      oauthGrantSource: "supabase_azure",
    });

    await supabase.auth.signOut();
    response.cookies.delete(TRAINER_MICROSOFT_SUPABASE_LINK_COOKIE);
    return response;
  }

  const state = url.searchParams.get("state");
  if (!state?.trim()) {
    return redirectBack(req, "oauthError=invalid_state");
  }
  const st = await verifyVideoOAuthState(state);
  if (!st || st.provider !== "MICROSOFT") {
    return redirectBack(req, "oauthError=invalid_state");
  }

  const exchanged = await microsoftExchangeCode(code);
  if ("error" in exchanged) {
    return redirectBack(req, `oauthError=${encodeURIComponent(exchanged.error)}`);
  }
  let hint: string | null = null;
  if (exchanged.accessToken) {
    hint = await graphAccountHint(exchanged.accessToken);
  }
  await persistMicrosoftConnection({
    trainerId: st.trainerId,
    exchanged,
    hint,
    oauthGrantSource: "direct",
  });
  return redirectBack(req, "connected=microsoft");
}
