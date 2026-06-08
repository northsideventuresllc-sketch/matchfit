"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPortalNav } from "@/components/admin/admin-portal-nav";
import { AdminPortalBackdrop, adminAccentButtonClass, adminPanelClass } from "@/components/admin/admin-portal-ui";
import type { AdminAiProviderStatus } from "@/lib/admin-analytics-ai";

type ChatMessage = {
  id: string;
  role: string;
  content: string;
  actionType: string | null;
  createdAt: string;
};

const MODES = [
  {
    id: "freeform",
    label: "Custom question",
    placeholder: "Ask anything about traffic, revenue, goals, or growth…",
    hint: "Ask in your own words.",
  },
  {
    id: "potential_rating_advice",
    label: "Reach potential rating",
    placeholder: "Optional: any constraints or priorities? (leave blank for defaults)",
    hint: "How to close the gap to your potential success score.",
  },
  {
    id: "revenue_projection_advice",
    label: "Grow monthly revenue",
    placeholder: "Optional: focus area (trials, trainers, ads, services)…",
    hint: "Action plan for this month's realistic revenue target.",
  },
  {
    id: "site_analysis",
    label: "Site & traffic review",
    placeholder: "Optional: pages or campaigns to focus on…",
    hint: "Funnel leaks and CTA recommendations from live traffic.",
  },
  {
    id: "signup_recommendations",
    label: "Signup growth tips",
    placeholder: "Optional: client vs trainer priority…",
    hint: "Tactics to increase sign-ups for the beta launch.",
  },
  {
    id: "goal_analysis",
    label: "Review my goals",
    placeholder: "Optional: which goal matters most right now?",
    hint: "Compare active KPI goals to current metrics.",
  },
  {
    id: "set_goal",
    label: "Set a goal",
    placeholder: "Describe the KPI you want to track (deadline, target, metric)…",
    hint: "Creates a goal record and confirms the target in plain language.",
  },
] as const;

type ModeId = (typeof MODES)[number]["id"];

export function AdminAssistantClient(props: { aiStatus: AdminAiProviderStatus }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<ModeId>("freeform");
  const [input, setInput] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMode = useMemo(() => MODES.find((m) => m.id === mode) ?? MODES[0], [mode]);

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

  async function submit() {
    const message = input.trim();
    const title = goalTitle.trim();
    if (mode === "set_goal" && !message && !title) {
      setError("Describe your goal or enter a goal title before running.");
      return;
    }
    if (mode === "freeform" && !message) {
      setError("Type your question before sending.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/assistant/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          message: message || undefined,
          goalTitle: mode === "set_goal" ? title || undefined : undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
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
            <h1 className="text-2xl font-black">Analytics Assistant</h1>
            <p className="mt-2 text-sm text-white/55">
              Choose how you want to use the assistant, add context in the prompt box, then run. Responses use live
              platform metrics — test data excluded.
            </p>
          </div>
        </header>

        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            props.aiStatus.configured
              ? "border-emerald-400/20 bg-emerald-500/[0.06] text-emerald-100/90"
              : "border-amber-400/25 bg-amber-500/[0.07] text-amber-100/90"
          }`}
        >
          {props.aiStatus.message}
        </div>

        <div className={`space-y-4 ${adminPanelClass} p-4`}>
          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">How to use it</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as ModeId)}
              className="w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-2.5 text-sm"
            >
              {MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-white/45">{selectedMode.hint}</p>
          </label>

          {mode === "set_goal" ? (
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Goal title</span>
              <input
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                placeholder="e.g. 50 active platform subscribers by July"
                className="w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-2 text-sm"
              />
            </label>
          ) : null}

          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Your prompt</span>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={selectedMode.placeholder}
              rows={4}
              className="w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-sm"
            />
          </label>

          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className={`${adminAccentButtonClass} disabled:opacity-40`}
          >
            Run analysis
          </button>
        </div>

        <section className={`min-h-[16rem] space-y-3 ${adminPanelClass} p-4`}>
          {messages.length === 0 ? (
            <p className="text-sm text-white/45">
              No messages yet. Pick a mode, add your prompt, and click Run analysis.
            </p>
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
                <p className="text-[10px] font-black uppercase tracking-wide text-white/35">
                  {m.role === "assistant" ? "Assistant" : "You"}
                  {m.actionType ? ` · ${m.actionType.replace(/_/g, " ")}` : ""}
                </p>
                <p className="mt-1 whitespace-pre-wrap leading-relaxed">{m.content}</p>
              </div>
            ))
          )}
        </section>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>
    </main>
  );
}
