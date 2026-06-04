"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPortalNav } from "@/components/admin/admin-portal-nav";
import { AdminPortalBackdrop, adminAccentButtonClass, adminPanelClass } from "@/components/admin/admin-portal-ui";

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
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] px-5 py-10 text-white sm:px-8 sm:py-12">
      <AdminPortalBackdrop />
      <div className="relative z-10 mx-auto flex max-w-3xl flex-col gap-6">
        <header className="space-y-4">
          <AdminPortalNav current="assistant" />
          <div>
            <h1 className="text-2xl font-black">Analytics assistant</h1>
            <p className="mt-2 text-sm text-white/55">
              AI-powered goal setting and site analysis cross-referenced with live traffic and platform metrics (test
              data excluded).
            </p>
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          {ACTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={busy}
              onClick={() => void send(a.id)}
              className={`${adminAccentButtonClass} disabled:opacity-40`}
            >
              {a.label}
            </button>
          ))}
        </div>

        <section className={`min-h-[20rem] flex-1 space-y-3 ${adminPanelClass} p-4`}>
          {messages.length === 0 ? (
            <p className="text-sm text-white/45">No messages yet. Pick an action above or type below.</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl px-3 py-2 text-sm ${
                  m.role === "assistant"
                    ? "border border-[#FF7E00]/20 bg-[#FF7E00]/[0.06] text-[#FFD34E]/95"
                    : "border border-white/[0.06] bg-[#0E1016]/80 text-white/85"
                }`}
              >
                <p className="text-[10px] font-black uppercase tracking-wide text-white/35">{m.role}</p>
                <p className="mt-1 whitespace-pre-wrap leading-relaxed">{m.content}</p>
              </div>
            ))
          )}
        </section>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        <div className="space-y-2">
          <input
            value={goalTitle}
            onChange={(e) => setGoalTitle(e.target.value)}
            placeholder="Goal title (optional, for Set Goal)…"
            className="w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-2 text-sm"
          />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question or describe a goal…"
            rows={3}
            className="w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-sm"
          />
          <button
            type="button"
            disabled={busy || !input.trim()}
            onClick={() => void send("freeform", input)}
            className="rounded-xl bg-white/10 px-4 py-2 text-xs font-black uppercase disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}
