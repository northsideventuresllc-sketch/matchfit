import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ClientDashboardShell } from "@/components/client/client-dashboard-shell";
import { billingExemptDashboardPath, isClientBillingHardLocked } from "@/lib/client-billing-access";
import { prisma } from "@/lib/prisma";
import { purgeExpiredSuspensionRecords } from "@/lib/suspension-lifecycle";
import { staleClientSessionInvalidateRedirect } from "@/lib/stale-session-invalidate-url";
import { getSessionClientId } from "@/lib/session";

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
    },
  });
  if (!client) {
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

  const unreadCount = await prisma.clientNotification.count({
    where: { clientId, readAt: null },
  });

  const displayName = client.preferredName?.trim() || "Client";

  return (
    <ClientDashboardShell
      preferredName={displayName}
      profileImageUrl={client.profileImageUrl}
      initialUnreadCount={unreadCount}
    >
      {children}
    </ClientDashboardShell>
  );
}
