"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CONVERSATION_RELATIONSHIP_STAGES, SAFETY_REPORT_CATEGORIES } from "@/lib/safety-constants";

type Msg = { id: string; authorRole: string; body: string; createdAt: string };

const STAGE_LABEL: Record<string, string> = {
  POTENTIAL_CLIENT: "Potential client (default when matched)",
  LEAD: "Lead",
  FIRST_TIME_CLIENT: "First-time client",
  REGULAR_CLIENT: "Regular client",
  FORMER_CLIENT: "Former client",
};

export function TrainerClientChatThreadClient(props: { clientUsername: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [official, setOfficial] = useState<string | null>(null);
  const [stage, setStage] = useState("POTENTIAL_CLIENT");
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [blockDetails, setBlockDetails] = useState("");
  const [reportCat, setReportCat] = useState("other");
  const [reportDetails, setReportDetails] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/trainer/conversations/${encodeURIComponent(props.clientUsername)}/messages`);
      const data = (await res.json()) as {
        messages?: Msg[];
        officialChatStartedAt?: string | null;
        relationshipStage?: string;
        error?: string;
      };
      if (!res.ok) {
        setErr(data.error ?? "Could not load thread.");
        return;
      }
      setMessages(data.messages ?? []);
      setOfficial(data.officialChatStartedAt ?? null);
      if (data.relationshipStage) setStage(data.relationshipStage);
    } catch {
      setErr("Network error.");
    } finally {
      setLoading(false);
    }
  }, [props.clientUsername]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function send() {
    setErr(null);
    const res = await fetch(`/api/trainer/conversations/${encodeURIComponent(props.clientUsername)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    const data = (await res.json()) as { error?: string; message?: Msg };
    if (!res.ok) {
      setErr(data.error ?? "Could not send.");
      return;
    }
    if (data.message) setMessages((m) => [...m, data.message!]);
    setText("");
    void load();
  }

  async function updateStage(next: string) {
    setErr(null);
    const res = await fetch(`/api/trainer/conversations/${encodeURIComponent(props.clientUsername)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relationshipStage: next }),
    });
    const data = (await res.json()) as { error?: string; relationshipStage?: string };
    if (!res.ok) {
      setErr(data.error ?? "Could not update label.");
      return;
    }
    if (data.relationshipStage) setStage(data.relationshipStage);
  }

  async function blockClient() {
    setErr(null);
    const res = await fetch("/api/safety/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetUsername: props.clientUsername,
        targetIsTrainer: false,
        reasonDetails: blockDetails || null,
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setErr(data.error ?? "Could not block.");
      return;
    }
    window.location.href = "/trainer/dashboard/messages";
  }

  async function reportClient() {
    setErr(null);
    const res = await fetch("/api/safety/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetUsername: props.clientUsername,
        targetIsTrainer: false,
        category: reportCat,
        details: reportDetails,
      }),
    });
    const data = (await res.json()) as { error?: string; message?: string };
    if (!res.ok) {
      setErr(data.error ?? "Could not submit report.");
      return;
    }
    window.location.href = "/trainer/dashboard/messages";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">Relationship label</label>
          <select
            value={stage}
            onChange={(e) => {
              const v = e.target.value;
              setStage(v);
              void updateStage(v);
            }}
            className="w-full max-w-md rounded-xl border border-white/[0.08] bg-[#0E1016]/80 px-3 py-2 text-sm text-white"
          >
            {CONVERSATION_RELATIONSHIP_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s] ?? s}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setSafetyOpen((o) => !o)}
          className="inline-flex min-h-[2.5rem] items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] px-4 text-xs font-black uppercase tracking-[0.1em] text-white/80 transition hover:border-white/25"
        >
          {safetyOpen ? "Close safety" : "Block / report client"}
        </button>
      </div>

      {safetyOpen ? (
        <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-4">
          <p className="text-xs text-white/50">
            Blocking stops messages in both directions. Reports are routed to Match Fit for human review and
            automatically suspend the reported account until a representative lifts the suspension.
          </p>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Block (optional note)</p>
            <textarea
              value={blockDetails}
              onChange={(e) => setBlockDetails(e.target.value)}
              rows={2}
              className="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#0E1016]/80 px-3 py-2 text-xs text-white"
            />
            <button
              type="button"
              onClick={() => void blockClient()}
              className="mt-2 inline-flex min-h-[2.5rem] items-center justify-center rounded-xl border border-white/20 bg-white/[0.06] px-4 text-xs font-black uppercase tracking-[0.1em] text-white"
            >
              Block client
            </button>
          </div>
          <div className="border-t border-white/[0.06] pt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#E32B2B]/80">Report client</p>
            <select
              value={reportCat}
              onChange={(e) => setReportCat(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#0E1016]/80 px-3 py-2 text-xs text-white"
            >
              {SAFETY_REPORT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Details for Match Fit staff"
              rows={3}
              className="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#0E1016]/80 px-3 py-2 text-xs text-white"
            />
            <button
              type="button"
              onClick={() => void reportClient()}
              className="mt-2 inline-flex min-h-[2.5rem] items-center justify-center rounded-xl border border-[#E32B2B]/40 bg-[#E32B2B]/12 px-4 text-xs font-black uppercase tracking-[0.1em] text-[#FFB4B4]"
            >
              Submit report & suspend client
            </button>
          </div>
        </div>
      ) : null}

      {err ? (
        <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]">{err}</p>
      ) : null}

      {!official ? (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-4 text-sm text-amber-100/90">
          This thread is waiting to open. If the client came from a profile inquiry, accept it from{" "}
          <Link href="/trainer/dashboard/interests" className="font-semibold text-white underline-offset-2 hover:underline">
            Inquiries
          </Link>
          .
        </div>
      ) : null}

      <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 p-3">
        {loading ? (
          <p className="text-center text-sm text-white/45">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-white/45">No messages yet. Say hello.</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl px-3 py-2 text-sm ${
                m.authorRole === "TRAINER" ? "ml-8 bg-[#FF7E00]/15 text-white/90" : "mr-8 bg-white/[0.06] text-white/80"
              }`}
            >
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                {m.authorRole === "TRAINER" ? "You" : "Client"} ·{" "}
                {new Date(m.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </p>
              <p className="mt-1 whitespace-pre-wrap leading-relaxed">{m.body}</p>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!official}
          placeholder={official ? "Write a message…" : "Chat opens after the thread is active."}
          rows={3}
          className="min-h-[4.5rem] flex-1 resize-none rounded-xl border border-white/[0.08] bg-[#0E1016]/80 px-3 py-2 text-sm text-white placeholder:text-white/30 disabled:opacity-40"
        />
        <button
          type="button"
          disabled={!official || !text.trim()}
          onClick={() => void send()}
          className="inline-flex min-h-[3rem] shrink-0 items-center justify-center rounded-xl border border-[#FF7E00]/40 bg-[#FF7E00]/12 px-6 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-[#FF7E00]/55 disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
