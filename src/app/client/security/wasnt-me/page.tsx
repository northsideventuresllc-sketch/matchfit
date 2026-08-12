import { AccountWasntMePage } from "@/components/account-wasnt-me-page";

export default function ClientWasntMePage() {
  return <AccountWasntMePage apiPath="/api/client/security/wasnt-me" loginHref="/client" loginLabel="Sign-In" />;
}
