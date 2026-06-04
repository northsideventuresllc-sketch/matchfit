"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { adminPortalPrimaryButtonClass } from "@/components/admin/admin-portal-styles";

type ChatMessage = {
  id: string;
  role: string;
  content: string;
  actionType: string | null;
  createdAt: string;
};

const ACTIONS = [
  { id: "set_goal", label: "Set Goal" },
  { id: "goal_analysis", label: "Goal Analysis" },
  { id: "site_analysis", label: "Site Analysis" },
  { id: "signup_recommendations", label: "Signup Tips" },
  { id: "freeform", label: "Ask" },
] as const;

type ActionId = (typeof ACTIONS)[number]["id"];

export function AdminAssistantClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/admin/assistant/chat", { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as { messages?: ChatMessage[] };
    setMessages(data.messages ?? []);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadHistory();
    });
  }, [loadHistory]);

  async function send(action: ActionId, message?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/assistant/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          message: message ?? input,
          goalTitle: action === "set_goal" ? goalTitle || message || input : undefined,
        }),
      });
      const data = (await res.json()) as { error?: string; reply?: string };
      if (!res.ok) {
        setError(data.error ?? "Request failed.");
        return;
      }
      setInput("");
      setGoalTitle("");
      await loadHistory();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPortalShell
      current="assistant"
      maxWidth="3xl"
      title="Analytics Assistant"
      description="AI-powered goal setting and site analysis cross-referenced with live traffic and platform metrics (test data excluded)."
      contentClassName="flex flex-col gap-6"
    >
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={busy}
            onClick={() => void send(a.id)}
            className={`${adminPortalPrimaryButtonClass} px-3 py-2 text-[11px] tracking-wide`}
          >
            {a.label}
          </button>
        ))}
      </div>

      <section className="min-h-[20rem] flex-1 space-y-3 rounded-2xl border border-white/[0.08] bg-[#12151C]/75 p-4 backdrop-blur-xl">
        {messages.length === 0 ? (
          <p className="text-sm text-white/45">No messages yet. Pick an action above or type below.</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl px-3 py-2 text-sm ${
                m.role === "assistant"
                  ? "border border-[#FF7E00]/20 bg-[#FF7E00]/[0.06] text-[#FFD34E]/95"
                  : "border border-white/[0.06] bg-[#07080c]/80 text-white/85"
              }`}
            >
              <p className="text-[10px] font-black uppercase tracking-wide text-white/35">{m.role}</p>
              <p className="mt-1 whitespace-pre-wrap leading-relaxed">{m.content}</p>
            </div>
          ))
        )}
      </section>

      {error ? <p className="text-sm text-[#FFB4B4]">{error}</p> : null}

      <div className="space-y-2">
        <input
          value={goalTitle}
          onChange={(e) => setGoalTitle(e.target.value)}
          placeholder="Goal title (optional, for Set Goal)…"
          className="w-full rounded-xl border border-white/10 bg-[#07080c] px-4 py-2 text-sm outline-none focus:border-[#FF7E00]/35 focus:ring-2 focus:ring-[#FF7E00]/20"
        />
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question or describe a goal…"
          rows={3}
          className="w-full rounded-xl border border-white/10 bg-[#07080c] px-4 py-3 text-sm outline-none focus:border-[#FF7E00]/35 focus:ring-2 focus:ring-[#FF7E00]/20"
        />
        <button
          type="button"
          disabled={busy || !input.trim()}
          onClick={() => void send("freeform", input)}
          className={`${adminPortalPrimaryButtonClass} disabled:opacity-40`}
        >
          Send
        </button>
      </div>
    </AdminPortalShell>
  );
}
