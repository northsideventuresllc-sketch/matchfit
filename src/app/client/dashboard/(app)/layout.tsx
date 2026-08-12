import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ClientDashboardShell } from "@/components/client/client-dashboard-shell";
import { ClientDashboardPlanBanner } from "@/components/client/client-dashboard-plan-banner";
import { billingExemptDashboardPath, isClientBillingHardLocked } from "@/lib/client-billing-access";
import { syncClientPlatformBillingLifecycle } from "@/lib/client-platform-lifecycle";
import {
  countClientUnreadInboxNotifications,
  runClientNotificationLifecycle,
} from "@/lib/client-notification-retention";
import { isAccountDeletionGraceActive } from "@/lib/account-deletion-grace";
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
      securityLockedAt: true,
      stripeSubscriptionId: true,
      stripeSubscriptionActive: true,
      subscriptionGraceUntil: true,
      platformTrialEndsAt: true,
      paymentGraceUntil: true,
      accountDeactivatedAt: true,
      platformTrialConsumed: true,
      deidentifiedAt: true,
      accountDeletionRequestedAt: true,
      accountDeletionFinalizeAt: true,
    },
  });
  if (!client) {
    redirect(staleClientSessionInvalidateRedirect("/client"));
  }
  if (client.deidentifiedAt) {
    redirect(staleClientSessionInvalidateRedirect("/client"));
  }
  if (isAccountDeletionGraceActive(client)) {
    redirect("/client/account-deletion-scheduled");
  }

  if (client.safetySuspended) {
    redirect("/client/account-suspended");
  }
  if (client.securityLockedAt) {
    redirect("/client/account-locked");
  }

  await syncClientPlatformBillingLifecycle(clientId);
  const billingClient = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      matchPreferencesCompletedAt: true,
      stripeSubscriptionId: true,
      stripeSubscriptionActive: true,
      subscriptionGraceUntil: true,
      platformTrialEndsAt: true,
      paymentGraceUntil: true,
      accountDeactivatedAt: true,
      platformTrialConsumed: true,
      vipSubscriptionActive: true,
      clientPlanTier: true,
    },
  });
  if (!billingClient) {
    redirect(staleClientSessionInvalidateRedirect("/client"));
  }
  if (billingClient.accountDeactivatedAt) {
    redirect("/client/reactivate");
  }

  if (!billingClient.matchPreferencesCompletedAt) {
    redirect("/client/dashboard/preferences/onboarding");
  }

  const pathname = (await headers()).get("x-mf-pathname") ?? "";
  if (isClientBillingHardLocked(billingClient) && !billingExemptDashboardPath(pathname)) {
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
      planBanner={<ClientDashboardPlanBanner />}
    >
      {children}
    </ClientDashboardShell>
  );
}
