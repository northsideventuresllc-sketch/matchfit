"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import {
  ADMIN_AI_QUICK_PROMPTS,
  formatConversationTimestamp,
  formatMessageTimestamp,
  formatUserMessageForDisplay,
} from "@/lib/admin-assistant-labels";
import {
  adminPortalCardClass,
  adminPortalPrimaryButtonClass,
  adminPortalSecondaryButtonClass,
  adminPortalSectionEyebrowClass,
} from "@/components/admin/admin-portal-styles";

type ChatMessage = {
  id: string;
  role: string;
  content: string;
  actionType: string | null;
  createdAt: string;
};

type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

type AiStatus = {
  provider: "anthropic" | "openai";
  configured: boolean;
  working: boolean;
  model: string;
  message: string;
  availableModels?: { id: string; label: string }[];
};

type ActionId = (typeof ADMIN_AI_QUICK_PROMPTS)[number]["action"];

function AssistantMessageBody({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/);

  return (
    <div className="space-y-3 text-sm leading-relaxed text-white/90">
      {blocks.map((block, index) => {
        const lines = block.split("\n");
        const isBulletList = lines.every((line) => line.trim() === "" || /^[-•*]\s/.test(line.trim()));

        if (isBulletList && lines.some((line) => /^[-•*]\s/.test(line.trim()))) {
          return (
            <ul key={index} className="list-disc space-y-1.5 pl-5">
              {lines
                .map((line) => line.replace(/^[-•*]\s*/, "").trim())
                .filter(Boolean)
                .map((line, lineIndex) => (
                  <li key={lineIndex}>{line}</li>
                ))}
            </ul>
          );
        }

        return (
          <p key={index} className="whitespace-pre-wrap">
            {block}
          </p>
        );
      })}
    </div>
  );
}

export function AdminAssistantClient() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [showPastChats, setShowPastChats] = useState(false);
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);
  const [statsLine, setStatsLine] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialConversationSelected = useRef(false);

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/admin/assistant/status", { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as AiStatus;
    setStatus(data);
    setSelectedModel((prev) => prev || data.model);
  }, []);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/admin/assistant/conversations", { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as { conversations?: Conversation[] };
    setConversations(data.conversations ?? []);
  }, []);

  const loadMessages = useCallback(async (conversationId: string | null) => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    const res = await fetch(`/api/admin/assistant/chat?conversationId=${encodeURIComponent(conversationId)}`, {
      credentials: "include",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { messages?: ChatMessage[] };
    setMessages(data.messages ?? []);
  }, []);

  useEffect(() => {
    void fetch("/api/admin/overview", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          data: {
            memberOverview?: {
              totalActiveMembers: number;
              subscribedClients: number;
              freeTrialClients: number;
            };
            traffic?: { uniqueVisitors: number };
          } | null,
        ) => {
          if (!data?.memberOverview) return;
          setStatsLine(
            `${data.memberOverview.totalActiveMembers} active members · ${data.memberOverview.subscribedClients} subscribers · ${data.memberOverview.freeTrialClients} free trials · ${data.traffic?.uniqueVisitors ?? 0} visitors (7d)`,
          );
        },
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadStatus();
      const res = await fetch("/api/admin/assistant/conversations", { credentials: "include" });
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { conversations?: Conversation[] };
      const convos = data.conversations ?? [];
      if (cancelled) return;
      setConversations(convos);
      if (!initialConversationSelected.current && convos[0]) {
        initialConversationSelected.current = true;
        setActiveConversationId(convos[0].id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadStatus]);

  useEffect(() => {
    if (!activeConversationId) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch(
        `/api/admin/assistant/chat?conversationId=${encodeURIComponent(activeConversationId)}`,
        { credentials: "include" },
      );
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { messages?: ChatMessage[] };
      if (!cancelled) setMessages(data.messages ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeConversationId]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, busy]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );

  async function startNewChat() {
    setError(null);
    const res = await fetch("/api/admin/assistant/conversations", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = (await res.json()) as { conversation?: Conversation; error?: string };
    if (!res.ok || !data.conversation) {
      setError(data.error ?? "Could not start a new chat.");
      return;
    }
    setConversations((prev) => [data.conversation!, ...prev.filter((c) => c.id !== data.conversation!.id)]);
    setActiveConversationId(data.conversation.id);
    setMessages([]);
    setInput("");
    setGoalTitle("");
    setShowPastChats(false);
  }

  async function ensureConversationId(): Promise<string | null> {
    if (activeConversationId) return activeConversationId;

    const res = await fetch("/api/admin/assistant/conversations", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = (await res.json()) as { conversation?: Conversation; error?: string };
    if (!res.ok || !data.conversation) {
      setError(data.error ?? "Could not start a new chat.");
      return null;
    }

    setConversations((prev) => [data.conversation!, ...prev.filter((c) => c.id !== data.conversation!.id)]);
    setActiveConversationId(data.conversation.id);
    setMessages([]);
    return data.conversation.id;
  }

  async function send(action: ActionId, message?: string) {
    setBusy(true);
    setError(null);
    try {
      const conversationId = await ensureConversationId();
      if (!conversationId) return;

      const res = await fetch("/api/admin/assistant/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          message: message ?? input,
          goalTitle: action === "set_goal" ? goalTitle || message || input : undefined,
          conversationId,
          model: status?.provider === "anthropic" ? selectedModel : undefined,
        }),
      });
      const data = (await res.json()) as { error?: string; conversationId?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      if (data.conversationId) {
        setActiveConversationId(data.conversationId);
      }
      setInput("");
      setGoalTitle("");
      await Promise.all([loadMessages(data.conversationId ?? conversationId), loadConversations()]);
    } finally {
      setBusy(false);
    }
  }

  const statusTone = status?.working
    ? "border-emerald-400/25 bg-emerald-500/[0.08] text-emerald-100/90"
    : status?.configured
      ? "border-amber-400/25 bg-amber-500/[0.08] text-amber-100/90"
      : "border-white/10 bg-white/[0.04] text-white/55";

  const statusLabel = status?.working ? "AI Online" : status?.configured ? "Limited AI Mode" : "Built-In Insights Mode";

  return (
    <AdminPortalShell
      current="assistant"
      maxWidth="full"
      title="AI Assistant"
      description="Ask questions about traffic, sign-ups, goals, and platform health."
      headerActions={
        <button type="button" onClick={() => void startNewChat()} className={adminPortalPrimaryButtonClass}>
          New Chat
        </button>
      }
      contentClassName="flex flex-col gap-4 lg:gap-6"
    >
      <section className={`${adminPortalCardClass} flex min-h-[32rem] flex-col overflow-hidden`}>
        <div className="border-b border-white/[0.06] px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white/90">
                {activeConversation?.title ?? "Start a conversation"}
              </p>
              <p className="mt-1 text-xs text-white/45">
                {activeConversation
                  ? `${activeConversation.messageCount} message${activeConversation.messageCount === 1 ? "" : "s"} in this chat`
                  : "Type a question or pick a quick prompt below."}
              </p>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPastChats((v) => !v)}
                className={adminPortalSecondaryButtonClass}
              >
                Past Chats ({conversations.length})
              </button>
              {showPastChats ? (
                <div className="absolute right-0 top-full z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-white/10 bg-[#12151C] p-2 shadow-2xl">
                  {conversations.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-white/45">No saved chats yet.</p>
                  ) : (
                    <ul className="max-h-64 space-y-1 overflow-y-auto">
                      {conversations.map((convo) => {
                        const active = convo.id === activeConversationId;
                        return (
                          <li key={convo.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveConversationId(convo.id);
                                setShowPastChats(false);
                              }}
                              className={`w-full rounded-lg px-3 py-2 text-left transition ${
                                active
                                  ? "bg-[#FF7E00]/15 text-[#FFD34E]"
                                  : "text-white/70 hover:bg-white/[0.05]"
                              }`}
                            >
                              <p className="truncate text-sm font-semibold">{convo.title}</p>
                              <p className="text-[11px] text-white/40">
                                {formatConversationTimestamp(convo.updatedAt)} · {convo.messageCount} messages
                              </p>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="border-b border-white/[0.06] px-4 py-4 sm:px-5">
          {error ? <p className="mb-3 text-sm text-[#FFB4B4]">{error}</p> : null}
          <div className="space-y-2">
            <input
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder="Goal name (only if you are setting a KPI goal)"
              className="w-full rounded-xl border border-white/10 bg-[#07080c] px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#FF7E00]/35 focus:ring-2 focus:ring-[#FF7E00]/20"
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about traffic, sign-ups, goals, or platform health…"
                rows={3}
                className="min-h-[4.5rem] flex-1 rounded-xl border border-white/10 bg-[#07080c] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#FF7E00]/35 focus:ring-2 focus:ring-[#FF7E00]/20"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!busy && input.trim()) void send("freeform", input);
                  }
                }}
              />
              <button
                type="button"
                disabled={busy || !input.trim()}
                onClick={() => void send("freeform", input)}
                className={`${adminPortalPrimaryButtonClass} min-h-[4.5rem] sm:min-w-[7.5rem] disabled:opacity-40`}
              >
                Send
              </button>
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowQuickPrompts((v) => !v)}
              className={`${adminPortalSectionEyebrowClass} flex w-full items-center justify-between rounded-lg border border-white/[0.08] bg-[#0E1016]/60 px-3 py-2.5 text-left uppercase tracking-[0.16em] text-[#FFD34E]/90`}
            >
              <span>Quick Prompt Categories</span>
              <span className="text-white/40">{showQuickPrompts ? "−" : "+"}</span>
            </button>
            {showQuickPrompts ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {ADMIN_AI_QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt.action}
                    type="button"
                    disabled={busy}
                    onClick={() => void send(prompt.action)}
                    className="rounded-2xl border border-white/[0.08] bg-[#0E1016]/80 px-4 py-4 text-left transition hover:border-[#FF7E00]/25 hover:bg-[#FF7E00]/[0.05] disabled:opacity-40"
                  >
                    <p className="text-sm font-bold uppercase tracking-wide text-[#FFD34E]/95">{prompt.label}</p>
                    <p className="mt-2 text-xs leading-relaxed text-white/50">{prompt.description}</p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {status?.provider === "anthropic" && status.availableModels?.length ? (
            <div className="mt-4">
              <label className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Claude model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#07080c] px-3 py-2 text-sm text-white outline-none focus:border-[#FF7E00]/35"
              >
                {status.availableModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
          {messages.length === 0 ? (
            <p className="text-sm text-white/45">
              Your conversation will appear here. Use the prompt box above or expand quick prompt categories.
            </p>
          ) : (
            messages.map((m) => {
              const isAssistant = m.role === "assistant";
              return (
                <div key={m.id} className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[92%] rounded-2xl px-4 py-3 sm:max-w-[80%] ${
                      isAssistant
                        ? "border border-[#FF7E00]/20 bg-[#FF7E00]/[0.07]"
                        : "border border-white/[0.08] bg-[#07080c]/85"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">
                        {isAssistant ? "Match Fit Assistant" : "You"}
                      </p>
                      <time className="text-[10px] text-white/30">{formatMessageTimestamp(m.createdAt)}</time>
                    </div>
                    <div className="mt-2">
                      {isAssistant ? (
                        <AssistantMessageBody content={m.content} />
                      ) : (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">
                          {formatUserMessageForDisplay(m.content, m.actionType)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {busy ? (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-[#FF7E00]/15 bg-[#FF7E00]/[0.05] px-4 py-3 text-sm text-white/60">
                Thinking…
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <div className="space-y-3">
        {statsLine ? (
          <div className="rounded-2xl border border-[#FF7E00]/20 bg-[#FF7E00]/[0.06] px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#FFD34E]/90">Live Stats Snapshot</p>
            <p className="mt-1 text-sm text-white/75">{statsLine}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setInput(
                  "Summarize current dashboard stats and highlight the top 3 actions I should take this week.",
                );
              }}
              className={`mt-3 ${adminPortalSecondaryButtonClass}`}
            >
              Draft Stats Summary Prompt
            </button>
          </div>
        ) : null}

        <div className={`rounded-2xl border px-4 py-3 text-sm ${statusTone}`}>
          <p className="font-black uppercase tracking-[0.12em]">{statusLabel}</p>
          {status?.working || status?.configured ? (
            <p className="mt-1 text-[13px] opacity-90">
              {status?.working
                ? "Full AI answers are available for your questions."
                : "Quick prompts still work with built-in platform insights."}
            </p>
          ) : (
            <p className="mt-1 text-[13px] opacity-90">{status?.message ?? "Checking assistant status…"}</p>
          )}
        </div>
      </div>
    </AdminPortalShell>
  );
}
