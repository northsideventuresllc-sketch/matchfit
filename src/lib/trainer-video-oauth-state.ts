import { SignJWT, jwtVerify } from "jose";
import { getAuthSecretKey } from "@/lib/session";

export type VideoConferenceProviderKey = "GOOGLE" | "ZOOM" | "MICROSOFT";

export async function signVideoOAuthState(args: { trainerId: string; provider: VideoConferenceProviderKey }): Promise<string> {
  return new SignJWT({ t: "video_oauth", trainerId: args.trainerId, provider: args.provider })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .sign(getAuthSecretKey());
}

export async function verifyVideoOAuthState(
  token: string,
): Promise<{ trainerId: string; provider: VideoConferenceProviderKey } | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey());
    if (payload.t !== "video_oauth") return null;
    const trainerId = payload.trainerId;
    const provider = payload.provider;
    if (typeof trainerId !== "string" || typeof provider !== "string") return null;
    if (provider !== "GOOGLE" && provider !== "ZOOM" && provider !== "MICROSOFT") return null;
    return { trainerId, provider };
  } catch {
    return null;
  }
}

/** Correlates Supabase Entra/Azure OAuth return with the Match Fit trainer session (PKCE cookies are separate). */
export async function signTrainerMicrosoftSupabaseLinkState(trainerId: string): Promise<string> {
  return new SignJWT({ t: "trainer_ms_supabase_link", trainerId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .sign(getAuthSecretKey());
}

export async function verifyTrainerMicrosoftSupabaseLinkState(token: string): Promise<{ trainerId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey());
    if (payload.t !== "trainer_ms_supabase_link") return null;
    const trainerId = payload.trainerId;
    if (typeof trainerId !== "string" || !trainerId.trim()) return null;
    return { trainerId };
  } catch {
    return null;
  }
}

/** Correlates Supabase Zoom OAuth return with the Match Fit trainer session (PKCE verifier lives in Supabase cookies). */
export async function signTrainerZoomSupabaseLinkState(trainerId: string): Promise<string> {
  return new SignJWT({ t: "trainer_zoom_supabase_link", trainerId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .sign(getAuthSecretKey());
}

export async function verifyTrainerZoomSupabaseLinkState(token: string): Promise<{ trainerId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey());
    if (payload.t !== "trainer_zoom_supabase_link") return null;
    const trainerId = payload.trainerId;
    if (typeof trainerId !== "string" || !trainerId.trim()) return null;
    return { trainerId };
  } catch {
    return null;
  }
}
