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
