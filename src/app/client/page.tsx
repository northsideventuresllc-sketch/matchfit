import { redirectStayLoggedInClientToAccount } from "@/lib/redirect-stay-logged-in-client";
import LoginPortal from "./login-portal";

export default async function ClientPortalPage() {
  await redirectStayLoggedInClientToAccount();
  return <LoginPortal />;
}
