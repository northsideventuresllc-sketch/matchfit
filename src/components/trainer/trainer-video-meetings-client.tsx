"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Conn = {
  provider: string;
  hint: string | null;
  connectedAt: string;
};

export function TrainerVideoMeetingsClient() {
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<Conn[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const banner =
    searchParams.get("connected") === "google"
      ? "Google Calendar / Meet is connected."
      : searchParams.get("connected") === "zoom"
        ? "Zoom is connected."
        : searchParams.get("connected") === "microsoft"
          ? "Microsoft Teams is connected."
          : searchParams.get("oauthError")
            ? `Connection issue: ${searchParams.get("oauthError")}`
            : null;

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/trainer/dashboard/video-connections");
      const data = (await res.json()) as { connections?: Conn[]; error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Could not load connections.");
        return;
      }
      setConnections(data.connections ?? []);
    } catch {
      setErr("Network error.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function disconnect(provider: string) {
    if (!window.confirm(`Disconnect ${provider}?`)) return;
    setBusy(provider);
    setErr(null);
    try {
      const res = await fetch(`/api/trainer/dashboard/video-connections/${encodeURIComponent(provider)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Could not disconnect.");
        return;
      }
      void load();
    } finally {
      setBusy(null);
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const rows: { key: "GOOGLE" | "ZOOM" | "MICROSOFT"; label: string; blurb: string; startPath: string }[] = [
    {
      key: "GOOGLE",
      label: "Google Meet",
      blurb: "Creates Calendar events with a Meet link for each sync.",
      startPath: "/api/trainer/oauth/google/start",
    },
    {
      key: "ZOOM",
      label: "Zoom",
      blurb: "Creates scheduled Zoom meetings from your connected account.",
      startPath: "/api/trainer/oauth/zoom/start",
    },
    {
      key: "MICROSOFT",
      label: "Microsoft Teams",
      blurb: "Creates Teams online meetings via Microsoft Graph.",
      startPath: "/api/trainer/oauth/microsoft/start",
    },
  ];

  return (
    <div className="space-y-8">
      {banner ? (
        <p
          className={`rounded-xl border px-4 py-3 text-sm ${
            searchParams.get("oauthError")
              ? "border-amber-500/35 bg-amber-500/10 text-amber-100/90"
              : "border-emerald-500/35 bg-emerald-500/10 text-emerald-100/90"
          }`}
        >
          {banner}
        </p>
      ) : null}
      {err ? <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100/90">{err}</p> : null}

      <section className="rounded-2xl border border-white/[0.08] bg-[#10131c]/90 p-5 sm:p-6">
        <h2 className="text-lg font-bold text-white">Connect providers</h2>
        <p className="mt-2 text-xs leading-relaxed text-white/50">
          Authorize each vendor you want to use. Refresh tokens are stored encrypted (AES-256-GCM). Redirect URLs must be
          allow-listed in each vendor console as{" "}
          <code className="rounded bg-black/40 px-1 py-0.5 text-[10px] text-white/70">
            {origin || "(your origin)"}/api/trainer/oauth/&lt;provider&gt;/callback
          </code>
          .
        </p>
        <ul className="mt-5 space-y-3">
          {rows.map((r) => {
            const hit = connections.find((c) => c.provider === r.key);
            return (
              <li
                key={r.key}
                className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[#FF7E00]/90">{r.label}</p>
                  <p className="mt-1 text-[11px] text-white/50">{r.blurb}</p>
                  {hit?.hint ? (
                    <p className="mt-1 text-[10px] font-mono text-white/40">Linked: {hit.hint}</p>
                  ) : hit ? (
                    <p className="mt-1 text-[10px] text-emerald-200/70">Connected</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {hit ? (
                    <button
                      type="button"
                      disabled={busy === r.key}
                      onClick={() => void disconnect(r.key)}
                      className="rounded-lg border border-white/15 px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-white/70 transition hover:border-red-400/40 hover:text-red-100/90 disabled:opacity-40"
                    >
                      {busy === r.key ? "…" : "Disconnect"}
                    </button>
                  ) : (
                    <a
                      href={r.startPath}
                      className="inline-flex min-h-[2.5rem] items-center justify-center rounded-lg border border-[#FF7E00]/40 bg-[#FF7E00]/15 px-4 text-[10px] font-black uppercase tracking-[0.1em] text-white transition hover:border-[#FF7E00]/55"
                    >
                      Connect
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-[#10131c]/90 p-5 sm:p-6">
        <h2 className="text-lg font-bold text-white">Use in bookings</h2>
        <p className="mt-2 text-xs text-white/50">
          After a client pays on Match Fit, open their chat or the Bookings page. Attach a manual https link or tap sync
          to generate a meeting for that session window.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/trainer/dashboard/bookings" className="font-bold uppercase tracking-[0.08em] text-[#FF9A4A] underline-offset-2 hover:underline">
            Open bookings
          </Link>
        </p>
      </section>
    </div>
  );
}
