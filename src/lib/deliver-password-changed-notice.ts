import "server-only";
import { sendTransactionalEmailIfAllowed } from "@/lib/transactional-email-send";
import { signWasntMeToken, type SecurityLockAccountType } from "@/lib/account-security-lock";
import { getAppOriginFromRequest } from "@/lib/app-origin";

const WASNT_ME_PATH: Record<SecurityLockAccountType, string> = {
  client: "/client/security/wasnt-me",
  trainer: "/trainer/security/wasnt-me",
  admin: "/admin/security/wasnt-me",
};

/** Fires every time a password actually changes — self-service or via a reset link. */
export async function deliverPasswordChangedNotice(args: {
  accountType: SecurityLockAccountType;
  accountId: string;
  email: string;
  req: Request;
}): Promise<void> {
  const token = await signWasntMeToken(args.accountType, args.accountId);
  const origin = getAppOriginFromRequest(args.req);
  const wasntMeUrl = `${origin}${WASNT_ME_PATH[args.accountType]}?token=${encodeURIComponent(token)}`;

  await sendTransactionalEmailIfAllowed({
    kind: "PASSWORD_CHANGED_NOTICE",
    to: args.email.trim(),
    audience: args.accountType === "client" ? "CLIENT" : args.accountType === "trainer" ? "TRAINER" : "STAFF",
    clientId: args.accountType === "client" ? args.accountId : undefined,
    trainerId: args.accountType === "trainer" ? args.accountId : undefined,
    variables: { wasntMeUrl },
  });
}
