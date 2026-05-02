import { encryptUtf8 } from "@/lib/field-encryption";
import { prisma } from "@/lib/prisma";
import { verifyVideoOAuthState } from "@/lib/trainer-video-oauth-state";
import { microsoftExchangeCode, stringifyOAuthTokenBundle } from "@/lib/trainer-video-oauth-tokens";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function redirectBack(req: Request, query: string) {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || new URL(req.url).origin;
  return NextResponse.redirect(`${origin}/trainer/dashboard/video-meetings?${query}`);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const oauthErr = url.searchParams.get("error");
  if (oauthErr) {
    return redirectBack(req, `oauthError=${encodeURIComponent(oauthErr)}`);
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code?.trim() || !state?.trim()) {
    return redirectBack(req, "oauthError=missing_code");
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
    try {
      const r = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${exchanged.accessToken}` },
      });
      const j = (await r.json().catch(() => null)) as { mail?: string; userPrincipalName?: string } | null;
      const email = j?.mail || j?.userPrincipalName;
      if (email && typeof email === "string") {
        const [u, d] = email.split("@");
        if (u && d) hint = `${u.slice(0, 2)}…@${d}`;
      }
    } catch {
      /* non-fatal */
    }
  }
  await prisma.trainerVideoConferenceConnection.upsert({
    where: { trainerId_provider: { trainerId: st.trainerId, provider: "MICROSOFT" } },
    create: {
      trainerId: st.trainerId,
      provider: "MICROSOFT",
      encryptedOAuthBundle: encryptUtf8(stringifyOAuthTokenBundle(exchanged)),
      accessTokenExpiresAt: exchanged.expiresAtMs ? new Date(exchanged.expiresAtMs) : null,
      externalAccountHint: hint,
    },
    update: {
      encryptedOAuthBundle: encryptUtf8(stringifyOAuthTokenBundle(exchanged)),
      accessTokenExpiresAt: exchanged.expiresAtMs ? new Date(exchanged.expiresAtMs) : null,
      externalAccountHint: hint ?? undefined,
      revokedAt: null,
      updatedAt: new Date(),
    },
  });
  return redirectBack(req, "connected=microsoft");
}
