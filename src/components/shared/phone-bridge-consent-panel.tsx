"use client";

import { useCallback, useEffect, useState } from "react";

type Api = "/api/client/settings/phone-bridge" | "/api/trainer/settings/phone-bridge";

export function PhoneBridgeConsentPanel(props: { settingsApi: Api }) {
  const [allow, setAllow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(props.settingsApi);
      const data = (await res.json()) as { allowPhoneBridge?: boolean; error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Could not load settings.");
        return;
      }
      setAllow(Boolean(data.allowPhoneBridge));
    } catch {
      setErr("Network error.");
    } finally {
      setLoading(false);
    }
  }, [props.settingsApi]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(next: boolean) {
    setSaving(true);
    setErr(null);
    setOk(null);
    try {
      const res = await fetch(props.settingsApi, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowPhoneBridge: next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Could not save.");
        return;
      }
      setAllow(next);
      setOk(next ? "Masked calls enabled for your account." : "Masked calls disabled.");
    } catch {
      setErr("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 text-sm text-white/70">
      <p className="text-[11px] leading-relaxed text-white/55">
        When enabled, Match Fit may place <span className="font-semibold text-white/80">masked bridge calls</span> through
        our telephony partner so you can speak with a matched coach or client <span className="text-white/80">without</span>{" "}
        either side seeing the other&apos;s real phone number. Your number on file is used only for this routing and is{" "}
        <span className="font-semibold text-white/80">not shown, sold, or shared</span> with the other party. TLS protects
        data in transit; OAuth tokens for video providers are encrypted at rest (AES-256-GCM).
      </p>
      {loading ? <p className="text-xs text-white/45">Loading…</p> : null}
      {err ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100/90">{err}</p> : null}
      {ok ? <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100/90">{ok}</p> : null}
      {!loading ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
            <input
              type="checkbox"
              checked={allow}
              disabled={saving}
              onChange={(e) => void save(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-[#0E1016] text-[#FF7E00] focus:ring-[#FF7E00]/40"
            />
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-white/80">
              Allow Match Fit to use my phone for masked calls
            </span>
          </label>
        </div>
      ) : null}
    </div>
  );
}
