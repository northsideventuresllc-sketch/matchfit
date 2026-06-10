"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { adminPortalSecondaryButtonClass } from "@/components/admin/admin-portal-styles";

type InboxMessage = {
  id: string;
  createdAt: string;
  fromEmail: string;
  subject: string;
  textPreview: string;
  status: string;
};

export function SupportInboxClient() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/support-inbox", { credentials: "include" });
      const data = (await res.json()) as { messages?: InboxMessage[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not load inbox.");
        return;
      }
      setMessages(data.messages ?? []);
    } catch {
      setError("Could not load inbox.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- initial inbox fetch */
  useEffect(() => {
    void load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function markRead(id: string) {
    await fetch("/api/admin/support-inbox", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: "read" } : m)));
  }

  return (
    <AdminPortalShell
      current="support-inbox"
      title="Support Inbox"
      description="Inbound mail to support@match-fit.net (captured via Resend webhook when configured)."
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-white/50">
          {messages.filter((m) => m.status === "unread").length} unread · {messages.length} total
        </p>
        <button type="button" onClick={() => void load()} className={adminPortalSecondaryButtonClass}>
          Refresh
        </button>
      </div>

      {loading ? <p className="text-sm text-white/45">Loading…</p> : null}
      {error ? (
        <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        {messages.length === 0 && !loading ? (
          <p className="text-sm text-white/45">No messages yet. Configure Resend inbound for support@match-fit.net.</p>
        ) : (
          messages.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => void markRead(m.id)}
              className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                m.status === "unread"
                  ? "border-[#FF7E00]/30 bg-[#FF7E00]/[0.08]"
                  : "border-white/[0.06] bg-[#0c0f14]/80"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-white">{m.subject}</p>
                <span className="text-[10px] uppercase tracking-wider text-white/35">
                  {m.status === "unread" ? "Unread" : "Read"}
                </span>
              </div>
              <p className="mt-1 text-xs text-white/45">
                {m.fromEmail} · {new Date(m.createdAt).toLocaleString()}
              </p>
              {m.textPreview ? <p className="mt-2 text-sm text-white/65">{m.textPreview}</p> : null}
            </button>
          ))
        )}
      </div>
    </AdminPortalShell>
  );
}
