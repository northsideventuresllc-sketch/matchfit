import { getSessionTrainerId } from "@/lib/session";
import { signVideoOAuthState } from "@/lib/trainer-video-oauth-state";
import { microsoftAuthorizeUrl } from "@/lib/trainer-video-oauth-tokens";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const state = await signVideoOAuthState({ trainerId, provider: "MICROSOFT" });
  const url = microsoftAuthorizeUrl(state);
  if (!url) {
    return NextResponse.json(
      {
        error:
          "Microsoft OAuth is not configured. Set MICROSOFT_OAUTH_CLIENT_ID, MICROSOFT_OAUTH_CLIENT_SECRET, and NEXT_PUBLIC_APP_URL.",
      },
      { status: 503 },
    );
  }
  return NextResponse.redirect(url);
}
