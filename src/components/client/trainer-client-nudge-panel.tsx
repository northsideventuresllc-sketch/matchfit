"use client";

import { FormEvent, useState } from "react";

type Props = {
  clientUsername: string;
};

export function TrainerClientNudgePanel(props: Props) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      const res = await fetch("/api/trainer/clients/nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientUsername: props.clientUsername,
          message: message.trim() === "" ? null : message.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not send nudge.");
        return;
      }
      setOk("Nudge sent. They will see this on their dashboard.");
      setMessage("");
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-[#FF7E00]/25 bg-[#FF7E00]/8 p-6">
      <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF7E00]">Send a nudge</h2>
      <p className="mt-2 text-sm text-white/55">
        Introduce yourself in one short note. Clients can open chat from their dashboard when messaging is enabled.
      </p>
      <form onSubmit={(ev) => void handleSubmit(ev)} className="mt-4 space-y-3">
        {error ? (
          <p className="rounded-lg border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-3 py-2 text-xs text-[#FFB4B4]" role="alert">
            {error}
          </p>
        ) : null}
        {ok ? (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100" role="status">
            {ok}
          </p>
        ) : null}
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
          placeholder="Optional short note (max 500 characters)"
          className="w-full rounded-xl border border-white/10 bg-[#0E1016] px-3 py-2 text-sm text-white outline-none ring-[#FF7E00]/30 focus:ring-2"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl border border-[#FF7E00]/40 bg-[#FF7E00]/15 py-3 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:border-[#FF7E00]/55 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Nudge client"}
        </button>
      </form>
    </div>
  );
}
