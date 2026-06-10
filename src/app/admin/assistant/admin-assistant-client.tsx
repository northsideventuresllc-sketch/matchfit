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
} from "@/components/admin/admin-portal-styles";
import { ADMIN_ASSISTANT_SUMMARY } from "@/lib/admin-ai-copy";

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
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialConversationSelected = useRef(false);

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/admin/assistant/status", { credentials: "include" });
    if (!res.ok) return;
    setStatus((await res.json()) as AiStatus);
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
    setShowHistory(false);
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

  return (
    <AdminPortalShell
      current="assistant"
      maxWidth="full"
      title="AI Assistant"
      description={ADMIN_ASSISTANT_SUMMARY}
      headerActions={
        <button
          type="button"
          onClick={() => void startNewChat()}
          className={adminPortalPrimaryButtonClass}
        >
          New chat
        </button>
      }
      contentClassName="flex flex-col gap-4 lg:gap-6"
    >
      <div className={`rounded-2xl border px-4 py-3 text-sm ${statusTone}`}>
        <p className="font-semibold">
          {status?.working ? "AI online" : status?.configured ? "Limited AI mode" : "Built-in insights mode"}
        </p>
        <p className="mt-1 text-[13px] opacity-90">
          {status?.message ?? "Checking assistant status…"}
        </p>
        {status?.working ? (
          <p className="mt-2 text-xs opacity-75">
            Provider: {status.provider === "anthropic" ? "Anthropic (Claude)" : "OpenAI"} · {status.model}
          </p>
        ) : null}
      </div>

      <div className="flex min-h-[32rem] flex-col gap-4 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-6">
        <aside className={`${adminPortalCardClass} p-3 lg:p-4`}>
          <div className="mb-3 flex items-center justify-between gap-2 lg:hidden">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FF7E00]/75">Past chats</p>
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className={adminPortalSecondaryButtonClass}
            >
              {showHistory ? "Hide" : "Show"}
            </button>
          </div>

          <div className={`${showHistory ? "block" : "hidden"} space-y-2 lg:block`}>
            <p className="hidden text-[10px] font-black uppercase tracking-[0.18em] text-[#FF7E00]/75 lg:block">
              Past chats
            </p>
            {conversations.length === 0 ? (
              <p className="rounded-xl border border-white/[0.06] bg-[#07080c]/70 px-3 py-4 text-xs text-white/45">
                No saved chats yet. Start a new conversation to begin.
              </p>
            ) : (
              <ul className="max-h-[28rem] space-y-1 overflow-y-auto pr-1">
                {conversations.map((convo) => {
                  const active = convo.id === activeConversationId;
                  return (
                    <li key={convo.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveConversationId(convo.id);
                          setShowHistory(false);
                        }}
                        className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
                          active
                            ? "border border-[#FF7E00]/30 bg-[#FF7E00]/[0.1]"
                            : "border border-transparent hover:border-white/[0.08] hover:bg-white/[0.04]"
                        }`}
                      >
                        <p className="truncate text-sm font-semibold text-white/90">{convo.title}</p>
                        <p className="mt-1 text-[11px] text-white/40">
                          {formatConversationTimestamp(convo.updatedAt)} · {convo.messageCount} message
                          {convo.messageCount === 1 ? "" : "s"}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${adminPortalCardClass} flex min-h-[32rem] flex-col overflow-hidden`}>
          <div className="border-b border-white/[0.06] px-4 py-3 sm:px-5">
            <p className="text-sm font-semibold text-white/90">
              {activeConversation?.title ?? "Start a conversation"}
            </p>
            <p className="mt-1 text-xs text-white/45">
              {activeConversation
                ? `${activeConversation.messageCount} message${activeConversation.messageCount === 1 ? "" : "s"} in this chat`
                : "Pick a past chat or start a new one. Quick prompts below need no technical knowledge."}
            </p>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
            {messages.length === 0 ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-white/[0.06] bg-[#07080c]/70 px-4 py-5">
                  <p className="text-sm font-semibold text-white/85">What would you like help with?</p>
                  <p className="mt-2 text-sm leading-relaxed text-white/50">
                    Choose a quick prompt or type your own question. Answers use live platform metrics and site traffic
                    (test accounts excluded).
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {ADMIN_AI_QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt.action}
                      type="button"
                      disabled={busy}
                      onClick={() => void send(prompt.action)}
                      className="rounded-2xl border border-white/[0.08] bg-[#0E1016]/80 px-4 py-4 text-left transition hover:border-[#FF7E00]/25 hover:bg-[#FF7E00]/[0.05] disabled:opacity-40"
                    >
                      <p className="text-sm font-bold text-[#FFD34E]/95">{prompt.label}</p>
                      <p className="mt-2 text-xs leading-relaxed text-white/50">{prompt.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => {
                const isAssistant = m.role === "assistant";
                return (
                  <div
                    key={m.id}
                    className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
                  >
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

          <div className="border-t border-white/[0.06] px-4 py-4 sm:px-5">
            {error ? <p className="mb-3 text-sm text-[#FFB4B4]">{error}</p> : null}

            <div className="mb-3 flex flex-wrap gap-2">
              {ADMIN_AI_QUICK_PROMPTS.map((prompt) => (
                <button
                  key={`chip-${prompt.action}`}
                  type="button"
                  disabled={busy}
                  onClick={() => void send(prompt.action)}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-white/65 transition hover:border-[#FF7E00]/30 hover:text-[#FFD34E]/90 disabled:opacity-40"
                >
                  {prompt.label}
                </button>
              ))}
            </div>

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
          </div>
        </section>
      </div>
    </AdminPortalShell>
  );
}
