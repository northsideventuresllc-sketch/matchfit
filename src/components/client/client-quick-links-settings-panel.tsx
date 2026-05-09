"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  CLIENT_DASHBOARD_QUICK_LINK_OPTIONS,
  type ClientDashboardQuickLinkId,
} from "@/lib/client-dashboard-quick-links";

const MAX = 4;

type Props = {
  initialIds: ClientDashboardQuickLinkId[];
};

export function ClientQuickLinksSettingsPanel(props: Props) {
  const router = useRouter();
  const [ids, setIds] = useState<ClientDashboardQuickLinkId[]>(props.initialIds);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const toggle = useCallback((id: ClientDashboardQuickLinkId) => {
    setOk(false);
    setErr(null);
    setIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX) return prev;
      return [...prev, id];
    });
  }, []);

  async function save() {
    setBusy(true);
    setErr(null);
    setOk(false);
    try {
      const res = await fetch("/api/client/settings/quick-links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quickLinkIds: ids }),
      });
      const data = (await res.json()) as { error?: string; quickLinkIds?: ClientDashboardQuickLinkId[] };
      if (!res.ok) {
        setErr(data.error ?? "Could not save.");
        return;
      }
      if (Array.isArray(data.quickLinkIds)) {
        setIds(data.quickLinkIds);
      }
      setOk(true);
      router.refresh();
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const atCap = ids.length >= MAX;

  return (
    <div className="space-y-4 text-left">
      <p className="text-sm leading-relaxed text-white/55">
        Pick up to {MAX} shortcuts for the <strong className="text-white/80">Quick Links</strong> card on your client
        home. Same destinations as the dashboard navigation (Dashboard and Log out are not listed here).
      </p>
      <p className="text-xs text-white/40">
        Selected: {ids.length} / {MAX}
      </p>
      <ul className="space-y-2">
        {CLIENT_DASHBOARD_QUICK_LINK_OPTIONS.map((opt) => {
          const checked = ids.includes(opt.id);
          const disabled = !checked && atCap;
          return (
            <li key={opt.id}>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.08] bg-[#0E1016]/50 p-3 transition ${
                  disabled ? "cursor-not-allowed opacity-45" : "hover:border-white/[0.12]"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF7E00]"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(opt.id)}
                />
                <span className="min-w-0 text-sm font-semibold leading-snug text-white/95">{opt.settingsLabel}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {err ? (
        <p className="text-sm text-rose-300/90" role="alert">
          {err}
        </p>
      ) : null}
      {ok ? (
        <p className="text-sm text-emerald-200/90" role="status">
          Saved.
        </p>
      ) : null}
      <div className="flex justify-center">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="group relative isolate flex min-h-[2.75rem] w-full max-w-xs items-center justify-center overflow-hidden rounded-xl px-5 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] transition disabled:opacity-50"
        >
          <span
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]"
          />
          <span className="relative">{busy ? "Saving…" : "Save quick links"}</span>
        </button>
      </div>
    </div>
  );
}
