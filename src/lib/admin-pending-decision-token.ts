import { SignJWT, jwtVerify } from "jose";
import { getAuthSecretKey } from "@/lib/session";

export type AdminPendingDecisionAction = "approve" | "deny";

export async function signAdminPendingDecisionToken(
  pendingId: string,
  action: AdminPendingDecisionAction,
): Promise<string> {
  return new SignJWT({ t: "mf_admin_pending_decision", act: action })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(pendingId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getAuthSecretKey());
}

export async function verifyAdminPendingDecisionToken(
  token: string,
): Promise<{ pendingId: string; action: AdminPendingDecisionAction } | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey());
    if (payload.t !== "mf_admin_pending_decision") return null;
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    const act = payload.act === "approve" || payload.act === "deny" ? payload.act : null;
    if (!sub || !act) return null;
    return { pendingId: sub, action: act };
  } catch {
    return null;
  }
}
