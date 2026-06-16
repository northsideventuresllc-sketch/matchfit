import { SignJWT, jwtVerify } from "jose";
import { getAuthSecretKey } from "@/lib/session";

export type EmailTemplateChangeDecisionAction = "approve" | "deny";

export async function signEmailTemplateChangeDecisionToken(
  pendingId: string,
  action: EmailTemplateChangeDecisionAction,
): Promise<string> {
  return new SignJWT({ t: "mf_email_template_change", act: action })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(pendingId)
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(getAuthSecretKey());
}

export async function verifyEmailTemplateChangeDecisionToken(
  token: string,
): Promise<{ pendingId: string; action: EmailTemplateChangeDecisionAction } | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey());
    if (payload.t !== "mf_email_template_change") return null;
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    const act = payload.act === "approve" || payload.act === "deny" ? payload.act : null;
    if (!sub || !act) return null;
    return { pendingId: sub, action: act };
  } catch {
    return null;
  }
}

export async function signEmailTemplateChangeDenyFeedbackToken(pendingId: string): Promise<string> {
  return new SignJWT({ t: "mf_email_template_deny_feedback" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(pendingId)
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(getAuthSecretKey());
}

export async function verifyEmailTemplateChangeDenyFeedbackToken(token: string): Promise<{ pendingId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey());
    if (payload.t !== "mf_email_template_deny_feedback") return null;
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    if (!sub) return null;
    return { pendingId: sub };
  } catch {
    return null;
  }
}
