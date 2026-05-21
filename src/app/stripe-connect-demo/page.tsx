import Link from "next/link";
import { connectDemoStyles } from "@/lib/stripe-connect/demo-styles";
import { getStripeConnectClientOrNull } from "@/lib/stripe-connect/client";
import { StripeConnectSignupForm } from "./stripe-connect-signup-form";

export default function StripeConnectDemoHomePage() {
  const configured = Boolean(getStripeConnectClientOrNull());

  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#FF7E00]/90">Sample</p>
        <h1 className="text-3xl font-black tracking-tight text-white">Stripe Connect (V2)</h1>
        <p className={connectDemoStyles.muted}>
          Onboard sellers, create products on connected accounts, run a storefront with direct charges, and bill a
          platform subscription to the connected account.
        </p>
      </header>

      {!configured ? (
        <div className={`${connectDemoStyles.card} border-amber-500/30`}>
          <p className={connectDemoStyles.err}>
            STRIPE_SECRET_KEY is not set. Add it to <code className="text-white/80">.env</code> (see{" "}
            <code className="text-white/80">.env.example</code> and{" "}
            <span className="text-white/70">docs/stripe-connect-demo.md</span>
            ).
          </p>
        </div>
      ) : null}

      <div className={connectDemoStyles.card}>
        <h2 className="text-lg font-bold text-white">Create a connected account</h2>
        <p className={`mt-2 ${connectDemoStyles.muted}`}>
          Uses the V2 Accounts API — no top-level <code className="text-white/70">type: express|standard|custom</code>.
          We store the mapping in <code className="text-white/70">stripe_connect_demo_sellers</code>.
        </p>
        <div className="mt-6">
          <StripeConnectSignupForm disabled={!configured} />
        </div>
      </div>

      <p className={`text-center text-xs ${connectDemoStyles.muted}`}>
        <Link href="/" className="text-[#FF9A4A] hover:underline">
          ← Back to Match Fit
        </Link>
      </p>
    </div>
  );
}
