import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { safeInternalNextPath } from "@/lib/safe-internal-next-path";

/**
 * If the visitor has a valid client session and "stay logged in" is enabled,
 * send them to `next` when it is a safe internal path; otherwise the client dashboard.
 */
export async function redirectStayLoggedInClientToDashboard(nextRaw?: string | null): Promise<void> {
  const clientId = await getSessionClientId();
  if (!clientId) return;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { stayLoggedIn: true },
  });
  if (client?.stayLoggedIn) {
    const next = safeInternalNextPath(nextRaw);
    redirect(next ?? "/client/dashboard");
  }
}
