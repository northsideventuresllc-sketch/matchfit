import Link from "next/link";
import { connectDemoStyles } from "@/lib/stripe-connect/demo-styles";

type Props = {
  searchParams?: Promise<{ session_id?: string; accountId?: string }>;
};

export default async function StripeConnectSuccessPage({ searchParams }: Props) {
  const sp = searchParams ? await searchParams : {};
  const sessionId = typeof sp.session_id === "string" ? sp.session_id : null;
  const accountId = typeof sp.accountId === "string" ? sp.accountId : null;

  return (
    <div className={`${connectDemoStyles.card} text-center`}>
      <h1 className="text-2xl font-black text-white">Payment received</h1>
      <p className={`mt-3 ${connectDemoStyles.muted}`}>
        Thank you — this was a direct charge on the connected account with a platform application fee.
      </p>
      {sessionId ? (
        <p className="mt-2 font-mono text-xs text-white/40">Session: {sessionId}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {accountId ? (
          <Link
            href={`/stripe-connect-demo/store/${encodeURIComponent(accountId)}`}
            className={connectDemoStyles.btnSecondary}
          >
            Back to shop
          </Link>
        ) : null}
        <Link href="/stripe-connect-demo" className={connectDemoStyles.btnPrimary}>
          Demo home
        </Link>
      </div>
    </div>
  );
}
