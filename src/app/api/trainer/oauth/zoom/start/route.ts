import { getSessionTrainerId } from "@/lib/session";
import { signVideoOAuthState } from "@/lib/trainer-video-oauth-state";
import { zoomAuthorizeUrl } from "@/lib/trainer-video-oauth-tokens";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const state = await signVideoOAuthState({ trainerId, provider: "ZOOM" });
  const url = zoomAuthorizeUrl(state);
  if (!url) {
    return NextResponse.json(
      { error: "Zoom OAuth is not configured. Set ZOOM_OAUTH_CLIENT_ID, ZOOM_OAUTH_CLIENT_SECRET, and NEXT_PUBLIC_APP_URL." },
      { status: 503 },
    );
  }
  return NextResponse.redirect(url);
}
