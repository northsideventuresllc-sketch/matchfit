import { SignJWT, jwtVerify } from "jose";
import { getAuthSecretKey } from "@/lib/session";

export type TrainerBackgroundReviewAction = "approve" | "deny";

export async function signTrainerBackgroundReviewToken(
  trainerId: string,
  action: TrainerBackgroundReviewAction,
): Promise<string> {
  return new SignJWT({ t: "mf_trainer_bg_review", act: action })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(trainerId)
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(getAuthSecretKey());
}

export async function verifyTrainerBackgroundReviewToken(
  token: string,
): Promise<{ trainerId: string; action: TrainerBackgroundReviewAction } | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey());
    if (payload.t !== "mf_trainer_bg_review") return null;
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    const act = payload.act === "approve" || payload.act === "deny" ? payload.act : null;
    if (!sub || !act) return null;
    return { trainerId: sub, action: act };
  } catch {
    return null;
  }
}
