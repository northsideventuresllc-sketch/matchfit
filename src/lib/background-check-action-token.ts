import { SignJWT, jwtVerify } from "jose";
import { getAuthSecretKey } from "@/lib/session";

export type BackgroundCheckStaffAction = "confirm_invite_sent" | "approve" | "deny";

export async function signBackgroundCheckStaffToken(
  trainerId: string,
  action: BackgroundCheckStaffAction,
): Promise<string> {
  return new SignJWT({ t: "mf_bg_staff", act: action })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(trainerId)
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(getAuthSecretKey());
}

export async function verifyBackgroundCheckStaffToken(
  token: string,
): Promise<{ trainerId: string; action: BackgroundCheckStaffAction } | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey());
    if (payload.t !== "mf_bg_staff") return null;
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    const act =
      payload.act === "confirm_invite_sent" || payload.act === "approve" || payload.act === "deny"
        ? payload.act
        : null;
    if (!sub || !act) return null;
    return { trainerId: sub, action: act };
  } catch {
    return null;
  }
}
