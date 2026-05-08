"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { SessionCheckInPanelClient, type CheckInThreadPayload } from "@/components/chat/session-check-in-panels";
import type { ClientPairGovernancePayload } from "@/lib/marketplace-governance-overview";

function money(cents: number | null | undefined): string {
  if (cents == null || cents <= 0) return "0.00";
  return (cents / 100).toFixed(2);
}

export function ServiceManagementView(props: {
  feeDisclaimer: string;
  pairs: ClientPairGovernancePayload[];
}) {
  const router = useRouter();
  const [diyBusy, setDiyBusy] = useState<string | null>(null);
  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  async function ackDiy(trainerUsername: string) {
    setDiyBusy(trainerUsername);
    try {
      const res = await fetch(
        `/api/client/conversations/${encodeURIComponent(trainerUsername)}/diy/receivable/ack`,
        { method: "POST" },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Request failed.");
      refresh();
    } finally {
      setDiyBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 text-left">
      <header className="space-y-3 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF7E00]/90">Marketplace</p>
        <h1 className="text-balance text-2xl font-semibold text-white sm:text-3xl">Service Management</h1>
        <p className="mx-auto max-w-lg text-sm leading-relaxed text-white/55">
          Check in for sessions, confirm outcomes, file payout disputes after your coach closes their step, and track
          credits across your active coach relationships. Invites and virtual join links still surface in Chats.
        </p>
        <Link
          href="/client/dashboard/messages"
          className="inline-flex min-h-[2.5rem] items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] px-4 text-xs font-bold uppercase tracking-[0.1em] text-white/70 transition hover:border-[#FF7E00]/35 hover:text-white"
        >
          Open Chats (invites & joins)
        </Link>
      </header>

      {props.pairs.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#12151c]/80 px-4 py-8 text-center text-sm text-white/55">
          <p>No official coach chats yet.</p>
          <p className="mt-2">
            <Link href="/client/dashboard/find-trainers" className="text-[#FF9A4A] underline-offset-4 hover:underline">
              Discover coaches →
            </Link>
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {props.pairs.map((p) => {
            const checkInPayload: CheckInThreadPayload = {
              feeDisclaimer: props.feeDisclaimer,
              sessions: p.checkInSessions,
            };

            const latestEng = p.engagements[0];

            return (
              <section
                key={p.trainerId}
                className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#151821]/95 to-[#0b0d12]/98 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-6"
              >
                <div className="flex flex-col gap-3 border-b border-white/[0.06] pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{p.trainerDisplayName}</h2>
                    <p className="mt-1 text-[11px] text-white/40">Coach @{p.trainerUsername}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/trainers/${encodeURIComponent(p.trainerUsername)}`}
                      className="rounded-xl border border-white/12 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white/65 transition hover:border-[#FF7E00]/40 hover:text-[#FFD34E]"
                    >
                      Profile
                    </Link>
                    <Link
                      href={`/client/dashboard/messages/${encodeURIComponent(p.trainerUsername)}`}
                      className="rounded-xl border border-[#FF7E00]/35 bg-[#FF7E00]/12 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#FFD34E] transition hover:border-[#FF7E00]/55"
                    >
                      Chat
                    </Link>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-teal-500/20 bg-teal-950/15 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-teal-200/85">Goals from your coach</p>
                  {p.coachingGoals.length === 0 ? (
                    <p className="mt-1 text-[11px] text-white/45">No goals on file yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-left text-[11px] text-white/75">
                      {p.coachingGoals.map((g) => (
                        <li key={g.id} className="rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">{g.horizon}</p>
                          <p className="mt-1 text-white/90">{g.goalText}</p>
                          <p className="mt-1 text-white/50">Done when: {g.completionCriteria}</p>
                          <p className="mt-1 text-[10px] text-emerald-200/90">
                            {g.completedAt ? `Completed ${new Date(g.completedAt).toLocaleDateString()}` : "In progress"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-sky-500/20 bg-sky-950/20 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-200/85">Sessions left</p>
                    <p className="mt-1 text-sm text-white/85">
                      {p.credits.bookingUnlimitedAfterPurchase ? (
                        <span>Unlimited bookings on file (bundle / cadence).</span>
                      ) : (
                        <span>
                          <strong>{p.credits.creditsRemaining}</strong> of{" "}
                          <strong>{p.credits.sessionCreditsPurchased}</strong> scheduling credits remaining ({p.credits.sessionCreditsUsed} used).
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl border border-violet-500/20 bg-violet-950/20 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-200/85">Add-ons (ledger)</p>
                    {p.addons ? (
                      <p className="mt-1 text-sm text-white/85">
                        <strong>{p.addons.remainingUnitsEstimated}</strong> estimated unit(s) left (used{" "}
                        {p.addons.consumedUnitsEstimated} / {p.addons.totalUnitsFromLatestPurchase}).{" "}
                        {p.addons.perAddonUnitNetCents != null ? (
                          <span className="text-white/55">(~${money(p.addons.perAddonUnitNetCents)} net / unit)</span>
                        ) : null}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-white/50">No bundled add-ons recorded on latest purchase.</p>
                    )}
                  </div>
                </div>

                {p.pendingInviteCount > 0 ? (
                  <div className="mt-4 rounded-xl border border-amber-500/35 bg-amber-500/[0.08] px-4 py-3 text-[12px] text-amber-50/95">
                    <span className="font-semibold text-amber-200">{p.pendingInviteCount} pending invite(s).</span>{" "}
                    Open Chat to accept or decline scheduled times and access virtual join links.
                  </div>
                ) : null}

                {p.blockFreeSessionBookingUntilRepurchase ? (
                  <div className="mt-4 rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-50/95">
                    <span className="font-semibold text-rose-200">Repurchase required.</span> A coach-led reschedule was
                    declined under Match Fit policy. Complete a new paid checkout in Chat before more sessions can be
                    booked.
                  </div>
                ) : null}

                <div className="mt-6">
                  <SessionCheckInPanelClient
                    trainerUsername={p.trainerUsername}
                    checkInThread={checkInPayload}
                    onUpdated={refresh}
                  />
                </div>

                {latestEng ? (
                  <div className="mt-6 space-y-3 rounded-xl border border-emerald-500/25 bg-emerald-950/15 px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200/90">DIY / plan delivery</p>
                    <p className="text-[11px] text-white/55">
                      Status: <span className="font-semibold text-white/85">{latestEng.status.replace(/_/g, " ")}</span>. First
                      deliver-by: {new Date(latestEng.firstDeliverByAt).toLocaleDateString()}.
                      {latestEng.cycleFundsReleaseNotBeforeAt ? (
                        <>
                          {" "}
                          Earliest modeled funds release guard:{" "}
                          <span className="text-white/75">
                            {new Date(latestEng.cycleFundsReleaseNotBeforeAt).toLocaleString()}
                          </span>
                          .
                        </>
                      ) : null}
                    </p>
                    {!latestEng.clientReceivableAcknowledgedAt &&
                    (latestEng.trainerReceivableLoggedAt || latestEng.firstDeliveredAt) ? (
                      <button
                        type="button"
                        disabled={diyBusy === p.trainerUsername}
                        onClick={() => void ackDiy(p.trainerUsername)}
                        className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-100 disabled:opacity-40"
                      >
                        {diyBusy === p.trainerUsername ? "…" : "Acknowledge receipt (Confirmation of receivables)"}
                      </button>
                    ) : latestEng.clientReceivableAcknowledgedAt ? (
                      <p className="text-[11px] text-emerald-200/85">Receipt acknowledged — thank you.</p>
                    ) : (
                      <p className="text-[11px] text-white/45">
                        Waiting on coach to log the first DIY deliverable in Client Management.
                      </p>
                    )}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
