import { AccountWasntMePage } from "@/components/account-wasnt-me-page";

export default function AdminWasntMePage() {
  return (
    <AccountWasntMePage apiPath="/api/admin/security/wasnt-me" loginHref="/admin/login" loginLabel="Administrator Portal" />
  );
}
