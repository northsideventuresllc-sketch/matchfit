"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { connectDemoStyles } from "@/lib/stripe-connect/demo-styles";

type AccountStatus = {
  accountId: string;
  displayName: string | null;
  contactEmail: string | null;
  readyToProcessPayments: boolean;
  cardPaymentsStatus: string | null;
  requirementsStatus: string | null;
  onboardingComplete: boolean;
  platformSubscriptionStatus: string | null;
  platformSubscriptionId: string | null;
};

export function StripeConnectDashboardClient(props: {
  accountId: string;
  subscriptionFlash?: boolean;
}) {
  const { accountId } = props;
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [priceDollars, setPriceDollars] = useState("25.00");
  const [productMsg, setProductMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/stripe-connect-demo/sellers/${encodeURIComponent(accountId)}`);
      const data = (await res.json()) as AccountStatus & { error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Could not load status.");
        setStatus(null);
        return;
      }
      setStatus(data);
    } catch {
      setErr("Network error.");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(t);
  }, [refresh]);

  async function startOnboarding() {
    setBusy("onboard");
    setErr(null);
    try {
      const res = await fetch(
        `/api/stripe-connect-demo/sellers/${encodeURIComponent(accountId)}/account-link`,
        { method: "POST" },
      );
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setErr(data.error ?? "Could not start onboarding.");
        return;
      }
      window.location.href = data.url;
    } finally {
      setBusy(null);
    }
  }

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    setBusy("product");
    setProductMsg(null);
    const cents = Math.round(parseFloat(priceDollars) * 100);
    try {
      const res = await fetch(
        `/api/stripe-connect-demo/sellers/${encodeURIComponent(accountId)}/products`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: productName,
            description: productDesc,
            priceInCents: cents,
          }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setProductMsg(data.error ?? "Could not create product.");
        return;
      }
      setProductMsg("Product created.");
      setProductName("");
      setProductDesc("");
    } finally {
      setBusy(null);
    }
  }

  async function startPlatformSubscription() {
    setBusy("sub");
    try {
      const res = await fetch(
        `/api/stripe-connect-demo/sellers/${encodeURIComponent(accountId)}/subscription/checkout`,
        { method: "POST" },
      );
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setErr(data.error ?? "Could not start subscription checkout.");
        return;
      }
      window.location.href = data.url;
    } finally {
      setBusy(null);
    }
  }

  async function openBillingPortal() {
    setBusy("portal");
    try {
      const res = await fetch(
        `/api/stripe-connect-demo/sellers/${encodeURIComponent(accountId)}/billing-portal`,
        { method: "POST" },
      );
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setErr(data.error ?? "Could not open billing portal.");
        return;
      }
      window.location.href = data.url;
    } finally {
      setBusy(null);
    }
  }

  const storefrontPath = `/stripe-connect-demo/store/${encodeURIComponent(accountId)}`;

  return (
    <div className="space-y-8">
      <header className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#FF7E00]/90">Seller dashboard</p>
        <h1 className="mt-1 text-2xl font-black text-white">Connect demo</h1>
        <p className={`mt-2 font-mono text-xs text-white/45`}>{accountId}</p>
      </header>

      {props.subscriptionFlash ? (
        <p className={connectDemoStyles.ok} role="status">
          Subscription checkout completed — status updates via webhook.
        </p>
      ) : null}

      <section className={connectDemoStyles.card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Onboarding status</h2>
          <button type="button" className={connectDemoStyles.btnSecondary} onClick={() => void refresh()} disabled={loading}>
            Refresh from Stripe
          </button>
        </div>
        <p className={`mt-2 ${connectDemoStyles.muted}`}>
          Status is always loaded from the Accounts API (not stored in the database for this demo).
        </p>
        {loading ? (
          <p className={`mt-4 ${connectDemoStyles.muted}`}>Loading…</p>
        ) : status ? (
          <ul className="mt-4 space-y-2 text-sm text-white/80">
            <li>
              Card payments:{" "}
              <span className={status.readyToProcessPayments ? connectDemoStyles.badgeOk : connectDemoStyles.badgeWarn}>
                {status.cardPaymentsStatus ?? "unknown"}
              </span>
            </li>
            <li>Requirements: {status.requirementsStatus ?? "—"}</li>
            <li>Onboarding complete: {status.onboardingComplete ? "Yes" : "No"}</li>
            <li>
              Platform subscription (DB): {status.platformSubscriptionStatus ?? "none"}
              {status.platformSubscriptionId ? ` (${status.platformSubscriptionId})` : ""}
            </li>
          </ul>
        ) : null}
        {err ? (
          <p className={`mt-3 ${connectDemoStyles.err}`} role="alert">
            {err}
          </p>
        ) : null}
        <button
          type="button"
          className={`mt-6 ${connectDemoStyles.btnPrimary}`}
          onClick={() => void startOnboarding()}
          disabled={busy === "onboard"}
        >
          {busy === "onboard" ? "Redirecting…" : "Onboard to collect payments"}
        </button>
      </section>

      <section className={connectDemoStyles.card}>
        <h2 className="text-lg font-bold">Create a product</h2>
        <p className={`mt-2 ${connectDemoStyles.muted}`}>
          Created on the connected account via the <code className="text-white/70">Stripe-Account</code> header.
        </p>
        <form onSubmit={(e) => void createProduct(e)} className="mt-4 space-y-3">
          <div>
            <label className={connectDemoStyles.label}>Name</label>
            <input className={connectDemoStyles.input} value={productName} onChange={(e) => setProductName(e.target.value)} required />
          </div>
          <div>
            <label className={connectDemoStyles.label}>Description</label>
            <input className={connectDemoStyles.input} value={productDesc} onChange={(e) => setProductDesc(e.target.value)} />
          </div>
          <div>
            <label className={connectDemoStyles.label}>Price (USD)</label>
            <input
              className={connectDemoStyles.input}
              value={priceDollars}
              onChange={(e) => setPriceDollars(e.target.value)}
              inputMode="decimal"
              required
            />
          </div>
          {productMsg ? <p className={connectDemoStyles.ok}>{productMsg}</p> : null}
          <button type="submit" className={connectDemoStyles.btnPrimary} disabled={busy === "product"}>
            {busy === "product" ? "Creating…" : "Create product"}
          </button>
        </form>
        <p className={`mt-4 ${connectDemoStyles.muted}`}>
          Storefront:{" "}
          <Link href={storefrontPath} className="text-[#FF9A4A] hover:underline">
            {storefrontPath}
          </Link>
          <span className="block text-xs text-white/40 mt-1">
            Production: use a public slug or seller id in the URL instead of the raw Stripe account id.
          </span>
        </p>
      </section>

      <section className={connectDemoStyles.card}>
        <h2 className="text-lg font-bold">Platform subscription</h2>
        <p className={`mt-2 ${connectDemoStyles.muted}`}>
          Charges the connected account using Checkout <code className="text-white/70">customer_account</code> (V2 — same
          id as <code className="text-white/70">acct_...</code>).
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className={connectDemoStyles.btnPrimary}
            onClick={() => void startPlatformSubscription()}
            disabled={busy === "sub"}
          >
            {busy === "sub" ? "Redirecting…" : "Subscribe to platform plan"}
          </button>
          <button
            type="button"
            className={connectDemoStyles.btnSecondary}
            onClick={() => void openBillingPortal()}
            disabled={busy === "portal"}
          >
            {busy === "portal" ? "Opening…" : "Manage subscription"}
          </button>
        </div>
      </section>

      <p className="text-center">
        <Link href="/stripe-connect-demo" className="text-sm text-[#FF9A4A] hover:underline">
          ← New account
        </Link>
      </p>
    </div>
  );
}
