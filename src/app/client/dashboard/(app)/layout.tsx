import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ClientDashboardShell } from "@/components/client/client-dashboard-shell";
import { billingExemptDashboardPath, isClientBillingHardLocked } from "@/lib/client-billing-access";
import {
  countClientUnreadInboxNotifications,
  runClientNotificationLifecycle,
} from "@/lib/client-notification-retention";
import { getClientDiyGovernanceGate } from "@/lib/diy-governance";
import { prisma } from "@/lib/prisma";
import { purgeExpiredSuspensionRecords } from "@/lib/suspension-lifecycle";
import { AdminImpersonationStrip } from "@/components/admin/admin-impersonation-strip";
import { staleClientSessionInvalidateRedirect } from "@/lib/stale-session-invalidate-url";
import { getSessionClientId, getVerifiedAdminImpersonation } from "@/lib/session";

export default async function ClientDashboardAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const clientId = await getSessionClientId();
  if (!clientId) {
    redirect("/client");
  }
  await purgeExpiredSuspensionRecords();

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      preferredName: true,
      profileImageUrl: true,
      matchPreferencesCompletedAt: true,
      safetySuspended: true,
      stripeSubscriptionId: true,
      stripeSubscriptionActive: true,
      subscriptionGraceUntil: true,
      deidentifiedAt: true,
    },
  });
  if (!client) {
    redirect(staleClientSessionInvalidateRedirect("/client"));
  }
  if (client.deidentifiedAt) {
    redirect(staleClientSessionInvalidateRedirect("/client"));
  }

  if (client.safetySuspended) {
    redirect("/client/account-suspended");
  }

  if (!client.matchPreferencesCompletedAt) {
    redirect("/client/dashboard/preferences/onboarding");
  }

  const pathname = (await headers()).get("x-mf-pathname") ?? "";
  if (isClientBillingHardLocked(client) && !billingExemptDashboardPath(pathname)) {
    redirect("/client/dashboard/billing?locked=1");
  }

  await runClientNotificationLifecycle(clientId);
  const unreadCount = await countClientUnreadInboxNotifications(clientId);
  const diyGovernanceGate = await getClientDiyGovernanceGate(clientId);

  const displayName = client.preferredName?.trim() || "Client";

  let supportStrip: ReactNode = null;
  const adminImp = await getVerifiedAdminImpersonation();
  if (adminImp?.role === "client") {
    const subject = await prisma.client.findUnique({
      where: { id: adminImp.targetId },
      select: { username: true },
    });
    if (subject) {
      supportStrip = (
        <AdminImpersonationStrip portalRole="client" username={subject.username} testMode={adminImp.testMode} />
      );
    }
  }

  return (
    <ClientDashboardShell
      preferredName={displayName}
      profileImageUrl={client.profileImageUrl}
      initialUnreadCount={unreadCount}
      diyGovernanceGate={diyGovernanceGate}
      supportStrip={supportStrip}
    >
      {children}
    </ClientDashboardShell>
  );
}
