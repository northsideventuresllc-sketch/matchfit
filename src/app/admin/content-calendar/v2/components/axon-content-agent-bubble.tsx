"use client";

import { useEffect, useRef, useState } from "react";
import {
  adminInputClassSm,
  adminPrimaryButtonClass,
} from "@/components/admin/admin-portal-ui";
import type { ClientContentCalendarV2Post } from "@/lib/content-calendar/content-calendar-v2-store";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  executedActions?: string[];
  timestamp: string;
};

const QUICK_PROMPTS = [
  "Fix caption on today's video to focus on founding trainer promo",
  "Optimize hashtags for verified coach discovery",
  "Fire media agent for today",
  "Create an impromptu post for Friday about client results",
];

export function AxonContentAgentBubble({
  currentStage,
  activePosts,
  onRefreshCalendar,
}: {
  currentStage: string;
  activePosts: ClientContentCalendarV2Post[];
  onRefreshCalendar: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi JB! I'm your AXON Content Agent. Tell me what to fix across your calendar (captions, hashtags, video prompts, firing media agents, or impromptu posts) and I will execute it immediately.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 100);
    }
  }, [open, messages.length]);

  async function handleSend(textToSend?: string) {
    const text = (textToSend ?? input).trim();
    if (!text || busy) return;

    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/admin/content-calendar/v2/agent-chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
          context: {
            stage: currentStage,
            posts: activePosts.map((p) => ({
              id: p.id,
              postDate: p.postDate,
              postType: p.postType,
              targetGroup: p.targetGroup,
              theme: p.theme,
              caption: p.caption,
              hashtags: p.hashtags,
              visualPrompt: p.visualPrompt,
              workflowStage: p.workflowStage,
              mediaStatus: p.mediaStatus,
            })),
          },
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        reply?: string;
        executedActions?: string[];
        refreshed?: boolean;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error ?? "AXON agent did not respond.");
      }

      const assistantMsg: Message = {
        id: `asst_${Date.now()}`,
        role: "assistant",
        content: data.reply ?? "Action completed.",
        executedActions: data.executedActions,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (data.refreshed) {
        await onRefreshCalendar().catch((e) => console.error("Calendar refresh error:", e));
      }
    } catch (err) {
      const errorMsg: Message = {
        id: `err_${Date.now()}`,
        role: "assistant",
        content: err instanceof Error ? err.message : "Failed to communicate with AXON.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end font-sans">
      {/* Expanded Chat Drawer / Window */}
      {open ? (
        <div className="mb-3 flex h-[540px] max-h-[85vh] w-[370px] flex-col overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0E121A]/95 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:w-[440px]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.03] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF7E00] to-[#FFD34E] text-sm font-black text-black shadow-lg shadow-amber-500/20">
                ⚡
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0E121A] bg-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-black uppercase tracking-[0.14em] text-white">AXON Content Agent</h3>
                  <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold text-[#FFD34E]">
                    LIVE
                  </span>
                </div>
                <p className="text-[10px] text-white/50">Direct executor · Bypasses scheduled queue</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close AXON chat"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Messages Area */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4 text-xs leading-relaxed">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                    m.role === "user"
                      ? "bg-[#FF7E00] text-black font-semibold shadow-md"
                      : "border border-white/[0.08] bg-white/[0.04] text-white/90 shadow-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>

                  {/* Executed Action Chips */}
                  {m.executedActions && m.executedActions.length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-white/[0.08] pt-1.5">
                      {m.executedActions.map((act, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 rounded-md bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300"
                        >
                          <span>✓</span>
                          <span>{act}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <span className="mt-1 text-[9px] text-white/35">{m.timestamp}</span>
              </div>
            ))}

            {busy && (
              <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-xs text-white/60">
                <span className="h-2 w-2 animate-ping rounded-full bg-[#FFD34E]" />
                <span>AXON is thinking and executing changes…</span>
              </div>
            )}
          </div>

          {/* Quick Action Suggestions */}
          {messages.length <= 2 && (
            <div className="border-t border-white/[0.06] bg-black/20 p-2.5">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">Quick Prompts</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((qp, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => void handleSend(qp)}
                    disabled={busy}
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-left text-[10px] text-white/75 transition hover:border-[#FFD34E]/40 hover:bg-white/[0.08] hover:text-white"
                  >
                    {qp}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Row */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
            className="flex items-center gap-2 border-t border-white/[0.08] bg-[#0A0D13] p-3"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask AXON to fix, rewrite, or fire anything…"
              disabled={busy}
              className={`${adminInputClassSm} flex-1 text-xs`}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className={`${adminPrimaryButtonClass} shrink-0 px-3 py-1.5 text-xs font-bold`}
            >
              SEND
            </button>
          </form>
        </div>
      ) : null}

      {/* Floating Toggle Button */}
      <button
        type="button"
        aria-label="Open AXON Content Agent"
        onClick={() => setOpen((v) => !v)}
        className="group relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#FF7E00] via-[#FFA800] to-[#FFD34E] text-black shadow-[0_10px_35px_-5px_rgba(255,126,0,0.5)] transition hover:scale-105 active:scale-95"
      >
        <span className="text-xl font-black">⚡</span>

        {/* Pulsing online indicator */}
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-[#12151C] bg-emerald-500" />
        </span>

        {/* Hover Tooltip */}
        {!open && (
          <span className="pointer-events-none absolute right-16 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-xl border border-white/10 bg-[#0E121A]/95 px-3 py-1.5 text-xs font-bold text-white opacity-0 shadow-xl backdrop-blur-md transition group-hover:opacity-100">
            Chat with AXON Content Agent
          </span>
        )}
      </button>
    </div>
  );
}
