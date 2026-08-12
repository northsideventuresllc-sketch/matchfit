import { AccountWasntMePage } from "@/components/account-wasnt-me-page";

export default function TrainerWasntMePage() {
  return (
    <AccountWasntMePage
      apiPath="/api/trainer/security/wasnt-me"
      loginHref="/trainer/dashboard/login"
      loginLabel="Fitness Pro Sign-In"
    />
  );
}
