import { encryptUtf8 } from "@/lib/field-encryption";
import { prisma } from "@/lib/prisma";
import { verifyVideoOAuthState } from "@/lib/trainer-video-oauth-state";
import { stringifyOAuthTokenBundle, zoomExchangeCode } from "@/lib/trainer-video-oauth-tokens";
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
  if (!st || st.provider !== "ZOOM") {
    return redirectBack(req, "oauthError=invalid_state");
  }
  const exchanged = await zoomExchangeCode(code);
  if ("error" in exchanged) {
    return redirectBack(req, `oauthError=${encodeURIComponent(exchanged.error)}`);
  }
  let hint: string | null = null;
  if (exchanged.accessToken) {
    try {
      const r = await fetch("https://api.zoom.us/v2/users/me", {
        headers: { Authorization: `Bearer ${exchanged.accessToken}` },
      });
      const j = (await r.json().catch(() => null)) as { email?: string; id?: string } | null;
      if (j?.email && typeof j.email === "string") {
        const [u, d] = j.email.split("@");
        if (u && d) hint = `${u.slice(0, 2)}…@${d}`;
      } else if (j?.id) {
        hint = `zoom:${String(j.id).slice(0, 8)}…`;
      }
    } catch {
      /* non-fatal */
    }
  }
  await prisma.trainerVideoConferenceConnection.upsert({
    where: { trainerId_provider: { trainerId: st.trainerId, provider: "ZOOM" } },
    create: {
      trainerId: st.trainerId,
      provider: "ZOOM",
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
  return redirectBack(req, "connected=zoom");
}
