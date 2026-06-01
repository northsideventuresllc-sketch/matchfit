import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/session";

export type AdminSession = {
  adminId: string;
  testMode: boolean;
  rememberMe: boolean;
};

export async function requireAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const tok = store.get(ADMIN_SESSION_COOKIE)?.value;
  const sess = tok ? await verifyAdminSessionToken(tok) : null;
  if (!sess) return null;
  const row = await prisma.administrator.findUnique({
    where: { id: sess.adminId },
    select: { id: true },
  });
  if (!row) return null;
  return sess;
}
