"use client";

import { useState } from "react";
import {
  adminAccentButtonClass,
  adminInputClassSm,
  adminPanelClass,
} from "@/components/admin/admin-portal-ui";

type ChatTurn = { role: "user" | "assistant"; content: string };

const STARTER_PROMPTS = [
  "How is my ad spend doing this week?",
  "Which platform is getting the most clicks?",
  "Am I missing any tracking setup?",
];

function ChatBubble({ turn }: { turn: ChatTurn }) {
  const isUser = turn.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-[#FF7E00]/15 text-white/90"
            : "border border-white/[0.06] bg-[#0E1016]/80 text-white/80"
        }`}
      >
        {turn.content}
      </div>
    </div>
  );
}

/** Ads-analysis chatbot — asks /api/admin/ad-tracking/chat, which grounds answers in the live performance panel and campaign registry. */
export function AdTrackingChatWidget() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(message: string) {
    const text = message.trim();
    if (!text || sending) return;

    const nextTurns: ChatTurn[] = [...turns, { role: "user", content: text }];
    setTurns(nextTurns);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/ad-tracking/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: nextTurns.slice(-10),
        }),
      });
      const json = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not reach the ads copilot.");
      setTurns((prev) => [...prev, { role: "assistant", content: json.reply ?? "" }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the ads copilot.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={`${adminPanelClass} p-4`}>
      {turns.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-white/50">
            Ask about your ad spend, clicks, or campaigns in plain English — the copilot reads your live numbers above.
          </p>
          <div className="flex flex-wrap gap-2">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/65 hover:border-[#FF7E00]/30 hover:text-[#FFD34E]"
                onClick={() => void send(prompt)}
                disabled={sending}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
          {turns.map((turn, i) => (
            <ChatBubble key={i} turn={turn} />
          ))}
          {sending ? <p className="text-xs text-white/40">Thinking…</p> : null}
        </div>
      )}

      {error ? <p className="mt-3 text-xs text-[#FF8A8A]">{error}</p> : null}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          className={adminInputClassSm}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your ad performance…"
          disabled={sending}
        />
        <button type="submit" className={adminAccentButtonClass} disabled={sending || !input.trim()}>
          {sending ? "…" : "Ask"}
        </button>
      </form>
    </div>
  );
}
