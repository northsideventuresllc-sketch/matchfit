"use client";

import { useEffect, useRef, useState } from "react";
import { adminAccentButtonClass, adminInputClassSm, adminPrimaryButtonClass } from "@/components/admin/admin-portal-ui";

const ADS_CONVERSATION_TITLE_PREFIX = "Ads:";

const QUICK_PROMPTS = [
  "Summarize this week's ad spend and results.",
  "Where should I shift budget between platforms?",
  "Which campaign needs attention right now?",
];

type ChatMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

type AiStatus = {
  configured: boolean;
  working: boolean;
  message: string;
};

function AiMessageBody({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/);
  return (
    <div className="space-y-2 text-sm leading-relaxed text-white/90">
      {blocks.map((block, index) => {
        const lines = block.split("\n");
        const isBulletList = lines.some((line) => /^[-•*]\s/.test(line.trim()));
        if (isBulletList) {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
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

export function AdTrackingAiChat() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const statusRes = await fetch("/api/admin/assistant/status", { credentials: "include" });
      if (statusRes.ok && !cancelled) setStatus(await statusRes.json());

      const convosRes = await fetch("/api/admin/assistant/conversations", { credentials: "include" });
      if (!convosRes.ok || cancelled) return;
      const data = (await convosRes.json()) as {
        conversations?: { id: string; title: string; updatedAt: string }[];
      };
      const existing = (data.conversations ?? []).find((c) => c.title.startsWith(ADS_CONVERSATION_TITLE_PREFIX));
      if (!existing || cancelled) return;
      setConversationId(existing.id);
      const msgRes = await fetch(`/api/admin/ad-tracking/ai-analysis?conversationId=${encodeURIComponent(existing.id)}`, {
        credentials: "include",
      });
      if (!msgRes.ok || cancelled) return;
      const msgData = (await msgRes.json()) as { messages?: ChatMessage[] };
      if (!cancelled) setMessages(msgData.messages ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, busy]);

  async function ensureConversationId(): Promise<string | null> {
    if (conversationId) return conversationId;
    const res = await fetch("/api/admin/assistant/conversations", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `${ADS_CONVERSATION_TITLE_PREFIX} New conversation` }),
    });
    const data = (await res.json()) as { conversation?: { id: string }; error?: string };
    if (!res.ok || !data.conversation) {
      setError(data.error ?? "Could not start a new chat.");
      return null;
    }
    setConversationId(data.conversation.id);
    return data.conversation.id;
  }

  async function send(message: string) {
    const trimmed = message.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const id = await ensureConversationId();
      if (!id) return;
      const res = await fetch("/api/admin/ad-tracking/ai-analysis", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, conversationId: id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setInput("");
      const msgRes = await fetch(`/api/admin/ad-tracking/ai-analysis?conversationId=${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      if (msgRes.ok) {
        const msgData = (await msgRes.json()) as { messages?: ChatMessage[] };
        setMessages(msgData.messages ?? []);
      }
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = status?.working ? "AI online" : status?.configured ? "Limited AI mode" : "Built-in summary mode";
  const statusTone = status?.working
    ? "text-[#9BE7B0]"
    : status?.configured
      ? "text-amber-200/90"
      : "text-white/45";

  return (
    <div className="flex flex-col gap-4">
      <p className={`text-[11px] font-bold uppercase tracking-wide ${statusTone}`}>{statusLabel}</p>

      {error ? <p className="text-sm text-[#FFB4B4]">{error}</p> : null}

      <div ref={scrollRef} className="max-h-80 space-y-3 overflow-y-auto rounded-xl border border-white/[0.06] bg-[#0E1016]/80 p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-white/45">
            Ask about spend, clicks, conversions, or which campaign needs attention — answers use your live ad tracking
            numbers.
          </p>
        ) : (
          messages.map((m) => {
            const isAssistant = m.role === "assistant";
            return (
              <div key={m.id} className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-3 ${
                    isAssistant ? "border border-[#FF7E00]/20 bg-[#FF7E00]/[0.07]" : "border border-white/[0.08] bg-[#07080c]/85"
                  }`}
                >
                  <p className="mb-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/40">
                    {isAssistant ? "Ads copilot" : "You"}
                  </p>
                  {isAssistant ? (
                    <AiMessageBody content={m.content} />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">{m.content}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
        {busy ? <p className="text-sm text-white/50">Thinking…</p> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((prompt) => (
          <button key={prompt} type="button" disabled={busy} className={adminAccentButtonClass} onClick={() => void send(prompt)}>
            {prompt}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className={adminInputClassSm}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your ad campaigns…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !busy && input.trim()) {
              e.preventDefault();
              void send(input);
            }
          }}
        />
        <button
          type="button"
          disabled={busy || !input.trim()}
          onClick={() => void send(input)}
          className={`${adminPrimaryButtonClass} sm:shrink-0`}
        >
          Send
        </button>
      </div>
    </div>
  );
}
