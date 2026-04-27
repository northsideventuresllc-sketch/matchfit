import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { staleClientSessionInvalidateRedirect } from "@/lib/stale-session-invalidate-url";
import { getSessionClientId } from "@/lib/session";

export default async function ClientDashboardRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const clientId = await getSessionClientId();
  if (!clientId) {
    redirect("/client?next=%2Fclient%2Fdashboard");
  }
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true },
  });
  if (!client) {
    redirect(staleClientSessionInvalidateRedirect("/client"));
  }
  return children;
}
