import { redirectStayLoggedInClientToDashboard } from "@/lib/redirect-stay-logged-in-client";
import LoginPortal from "./login-portal";

export default async function ClientPortalPage() {
  await redirectStayLoggedInClientToDashboard();
  return <LoginPortal />;
}
