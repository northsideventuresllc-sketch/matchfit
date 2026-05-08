"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { ClientDiyGovernanceGate } from "@/lib/diy-governance";

export function ClientDiyGovernanceGateBanner(props: { gate: ClientDiyGovernanceGate }) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function post(url: string, body: object) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(data.error ?? "Request failed.");
  }

  if (props.gate.kind === "post_due_attest") {
    const g = props.gate;
    return (
      <div className="mb-6 rounded-2xl border border-amber-500/35 bg-amber-950/25 px-4 py-4 text-left shadow-[0_8px_30px_-18px_rgba(251,191,36,0.35)]">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-200/90">DIY follow-up required</p>
        <p className="mt-2 text-sm text-white/80">
          Your DIY calendar deadline with <span className="font-semibold text-white">@{g.trainerUsername}</span> passed
          before your coach logged the first deliverable. Did you still receive what was promised?
        </p>
        <p className="mt-1 text-xs text-white/45">Deadline was {new Date(g.dueIso).toLocaleString()}.</p>
        {err ? <p className="mt-2 text-xs text-rose-200/90">{err}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setErr(null);
              setBusy(true);
              try {
                await post("/api/client/diy/governance/post-due-attest", { engagementId: g.engagementId, received: true });
                refresh();
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Error");
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-emerald-100"
          >
            Yes — I received it
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setErr(null);
              setBusy(true);
              try {
                await post("/api/client/diy/governance/post-due-attest", { engagementId: g.engagementId, received: false });
                refresh();
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Error");
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-xl border border-rose-400/40 bg-rose-500/12 px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-rose-100"
          >
            No — not received
          </button>
        </div>
      </div>
    );
  }

  const g = props.gate;
  return (
    <div className="mb-6 rounded-2xl border border-sky-500/35 bg-sky-950/25 px-4 py-4 text-left">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-200/90">DIY extension approval</p>
      <p className="mt-2 text-sm text-white/80">
        <span className="font-semibold text-white">@{g.trainerUsername}</span> requested{" "}
        <span className="font-semibold text-white">{g.hoursRequested}</span> additional hours to upload your DIY deliverable.
      </p>
      <p className="mt-1 text-xs text-white/45">
        Decide by {new Date(g.decideByIso).toLocaleString()}. If you do nothing, Match Fit auto-approves after 48 hours.
      </p>
      {err ? <p className="mt-2 text-xs text-rose-200/90">{err}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setErr(null);
            setBusy(true);
            try {
              await post("/api/client/diy/governance/extension-decision", { engagementId: g.engagementId, approved: true });
              refresh();
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Error");
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-emerald-100"
        >
          Approve extension
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (!window.confirm("Decline? The net DIY purchase amount may be refunded to your card; fees may be retained."))
              return;
            setErr(null);
            setBusy(true);
            try {
              await post("/api/client/diy/governance/extension-decision", {
                engagementId: g.engagementId,
                approved: false,
              });
              refresh();
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Error");
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-xl border border-rose-400/40 bg-rose-500/12 px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-rose-100"
        >
          Decline (refund net DIY)
        </button>
      </div>
    </div>
  );
}
