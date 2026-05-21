import Link from "next/link";
import { connectDemoStyles } from "@/lib/stripe-connect/demo-styles";
import { StripeConnectDashboardClient } from "./stripe-connect-dashboard-client";

type Props = { searchParams?: Promise<{ accountId?: string; subscription?: string }> };

export default async function StripeConnectDashboardPage({ searchParams }: Props) {
  const sp = searchParams ? await searchParams : {};
  const accountId = typeof sp.accountId === "string" ? sp.accountId : "";
  const subscriptionFlash = sp.subscription === "success";

  if (!accountId) {
    return (
      <div className={connectDemoStyles.card}>
        <p className={connectDemoStyles.err}>Missing accountId query parameter.</p>
        <Link href="/stripe-connect-demo" className="mt-4 inline-block text-[#FF9A4A] hover:underline">
          Create an account
        </Link>
      </div>
    );
  }

  return (
    <StripeConnectDashboardClient
      accountId={accountId}
      subscriptionFlash={subscriptionFlash}
    />
  );
}
