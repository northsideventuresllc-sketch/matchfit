import { redirect } from "next/navigation";
import { AccountDeletionScheduledPanel } from "@/components/account-deletion-scheduled-panel";
import {
  finalizeScheduledDeletionIfOverdue,
  isAccountDeletionGraceActive,
} from "@/lib/account-deletion-grace";
import { prisma } from "@/lib/prisma";
import { staleClientSessionInvalidateRedirect } from "@/lib/stale-session-invalidate-url";
import { getSessionClientId } from "@/lib/session";

export default async function ClientAccountDeletionScheduledPage() {
  const clientId = await getSessionClientId();
  if (!clientId) {
    redirect("/client");
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      deidentifiedAt: true,
      accountDeletionRequestedAt: true,
      accountDeletionFinalizeAt: true,
    },
  });
  if (!client || client.deidentifiedAt) {
    redirect(staleClientSessionInvalidateRedirect("/client"));
  }
  if (await finalizeScheduledDeletionIfOverdue({ role: "client", id: clientId })) {
    redirect(staleClientSessionInvalidateRedirect("/client"));
  }
  if (!isAccountDeletionGraceActive(client) || !client.accountDeletionFinalizeAt) {
    redirect("/client/dashboard");
  }

  return (
    <AccountDeletionScheduledPanel
      role="client"
      finalizeAtIso={client.accountDeletionFinalizeAt.toISOString()}
    />
  );
}
