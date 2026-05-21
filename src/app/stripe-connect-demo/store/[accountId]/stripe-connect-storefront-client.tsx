"use client";

import { useCallback, useEffect, useState } from "react";
import { connectDemoStyles } from "@/lib/stripe-connect/demo-styles";

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  unitAmount: number | null;
  currency: string;
};

export function StripeConnectStorefrontClient({ accountId }: { accountId: string }) {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/stripe-connect-demo/sellers/${encodeURIComponent(accountId)}/products`);
      const data = (await res.json()) as { products?: ProductRow[]; error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Could not load products.");
        setProducts([]);
        return;
      }
      setProducts(data.products ?? []);
    } catch {
      setErr("Network error.");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function buy(productId: string) {
    setBusyId(productId);
    setErr(null);
    try {
      const res = await fetch(`/api/stripe-connect-demo/store/${encodeURIComponent(accountId)}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setErr(data.error ?? "Could not start checkout.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setErr("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className={connectDemoStyles.muted}>Loading products…</p>;
  if (err) {
    return (
      <p className={connectDemoStyles.err} role="alert">
        {err}
      </p>
    );
  }
  if (!products.length) {
    return <p className={connectDemoStyles.muted}>No products yet — create one in the seller dashboard.</p>;
  }

  return (
    <ul className="space-y-4">
      {products.map((p) => (
        <li
          key={p.id}
          className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-[#0E1016]/80 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-semibold text-white">{p.name}</p>
            {p.description ? <p className="mt-1 text-sm text-white/50">{p.description}</p> : null}
            <p className="mt-2 text-sm text-[#FFD34E]">
              {p.unitAmount != null
                ? `$${(p.unitAmount / 100).toFixed(2)} ${p.currency.toUpperCase()}`
                : "Price on request"}
            </p>
          </div>
          <button
            type="button"
            className={connectDemoStyles.btnPrimary}
            onClick={() => void buy(p.id)}
            disabled={busyId === p.id}
          >
            {busyId === p.id ? "Redirecting…" : "Buy"}
          </button>
        </li>
      ))}
    </ul>
  );
}
