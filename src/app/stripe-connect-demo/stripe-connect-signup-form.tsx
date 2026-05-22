"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { connectDemoStyles } from "@/lib/stripe-connect/demo-styles";

export function StripeConnectSignupForm({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/stripe-connect-demo/sellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, contactEmail }),
      });
      const data = (await res.json()) as { error?: string; accountId?: string };
      if (!res.ok) {
        setErr(data.error ?? "Could not create account.");
        return;
      }
      if (data.accountId) {
        router.push(`/stripe-connect-demo/dashboard?accountId=${encodeURIComponent(data.accountId)}`);
      }
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <div>
        <label className={connectDemoStyles.label}>Display name</label>
        <input
          className={connectDemoStyles.input}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          disabled={disabled || busy}
        />
      </div>
      <div>
        <label className={connectDemoStyles.label}>Contact email</label>
        <input
          type="email"
          className={connectDemoStyles.input}
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          required
          disabled={disabled || busy}
        />
      </div>
      {err ? (
        <p className={connectDemoStyles.err} role="alert">
          {err}
        </p>
      ) : null}
      <button type="submit" className={connectDemoStyles.btnPrimary} disabled={disabled || busy}>
        {busy ? "Creating…" : "Create connected account"}
      </button>
    </form>
  );
}
