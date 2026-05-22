import { connectDemoStyles } from "@/lib/stripe-connect/demo-styles";
import { StripeConnectStorefrontClient } from "./stripe-connect-storefront-client";

type Props = { params: Promise<{ accountId: string }> };

export default async function StripeConnectStorePage({ params }: Props) {
  const { accountId } = await params;

  return (
    <div className="space-y-6">
      <header className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#FF7E00]/90">Storefront</p>
        <h1 className="mt-1 text-2xl font-black text-white">Shop</h1>
        {/* Demo only: use a stable public seller slug in production instead of acct_ in the URL. */}
        <p className="mt-2 font-mono text-xs text-white/40">{accountId}</p>
      </header>
      <div className={connectDemoStyles.card}>
        <StripeConnectStorefrontClient accountId={accountId} />
      </div>
    </div>
  );
}
