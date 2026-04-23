import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";

/**
 * If the visitor has a valid client session and "stay logged in" is enabled,
 * send them straight to the client dashboard (used from `/` and `/client`).
 */
export async function redirectStayLoggedInClientToAccount(): Promise<void> {
  const clientId = await getSessionClientId();
  if (!clientId) return;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { stayLoggedIn: true },
  });
  if (client?.stayLoggedIn) {
    redirect("/client/account");
  }
}
