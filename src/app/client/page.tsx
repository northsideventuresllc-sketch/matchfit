import { redirectStayLoggedInClientToDashboard } from "@/lib/redirect-stay-logged-in-client";
import { safeInternalNextPath } from "@/lib/safe-internal-next-path";
import LoginPortal from "./login-portal";

type PageProps = { searchParams: Promise<{ next?: string }> };

export default async function ClientPortalPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  await redirectStayLoggedInClientToDashboard(sp.next);
  return <LoginPortal defaultNext={safeInternalNextPath(sp.next)} />;
}
