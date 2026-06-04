"use client";

import Link from "next/link";
import { useState } from "react";
import { coerceTrainerBackgroundVendorStatus } from "@/lib/trainer-onboarding-status";

type Props = {
  backgroundCheckStatus: string;
  inviteRequestedAt: string | null;
  inviteSentAt: string | null;
  signupEscrowActive: boolean;
  compact?: boolean;
};

export function TrainerBackgroundCheckPlanBPanel({
  backgroundCheckStatus,
  inviteRequestedAt,
  inviteSentAt,
  signupEscrowActive,
  compact = false,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bgStatus = coerceTrainerBackgroundVendorStatus(backgroundCheckStatus);
  const requested = Boolean(inviteRequestedAt);
  const sent = Boolean(inviteSentAt);

  async function requestInvite() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/trainer/onboarding/background-check/request-invite", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string; message?: string; invitationUrl?: string | null };
      if (!res.ok) {
        setError(data.error ?? "Could not submit your request.");
        return;
      }
      setMessage(data.message ?? "Request submitted.");
      if (data.invitationUrl) {
        window.open(data.invitationUrl, "_blank", "noopener,noreferrer");
      }
      window.location.reload();
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function reportComplete() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/trainer/onboarding/background-check/report-complete", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not submit.");
        return;
      }
      setMessage(data.message ?? "Thanks — we will verify your results.");
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (bgStatus === "APPROVED") {
    return (
      <p className="mt-3 text-sm text-emerald-200/85">
        Background screening cleared. Your signup fee escrow has been applied per Match Fit policy.
      </p>
    );
  }

  if (bgStatus === "DENIED") {
    return (
      <p className="mt-3 text-sm text-rose-200/90">
        Screening did not clear. The background-check portion of your signup authorization was not applied. See Terms
        for details.
      </p>
    );
  }

  return (
    <div className={compact ? "space-y-3" : "mt-4 space-y-4"}>
      <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/95">
        <p className="font-semibold text-amber-50">Backup screening (Checkr API pending)</p>
        <p className="mt-1 text-amber-100/85">
          Match Fit is using our manual Checkr invitation process while the direct API finishes setup. Your signup fee
          {signupEscrowActive ? " is held in Stripe" : ""} until screening is ordered and approved.
          {!signupEscrowActive ? (
            <>
              {" "}
              <Link href="/trainer/signup/payment" className="font-semibold text-[#FFD34E] underline">
                Authorize signup fee
              </Link>{" "}
              first.
            </>
          ) : null}
        </p>
      </div>

      {!requested ? (
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0E1016]/90 p-5">
          <div
            className="pointer-events-none absolute inset-0 z-10 backdrop-blur-md"
            aria-hidden
            style={{
              background:
                "linear-gradient(135deg, rgba(11,12,15,0.55) 0%, rgba(255,126,0,0.08) 50%, rgba(11,12,15,0.65) 100%)",
            }}
          />
          <div className="relative z-20 space-y-3">
            <p className="text-sm text-white/70">
              Automated Checkr ordering is temporarily unavailable. Request your invitation — we will email Checkr
              screening steps to you after Match Fit sends the invite.
            </p>
            <Link
              href="/trainer/onboarding/background-check/request-invite"
              className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-5 text-xs font-black uppercase tracking-[0.1em] text-[#0B0C0F]"
            >
              Request Checkr invite
            </Link>
            <button
              type="button"
              disabled={busy || !signupEscrowActive}
              onClick={() => void requestInvite()}
              className="ml-2 inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-white/20 bg-white/[0.06] px-4 text-xs font-black uppercase tracking-[0.08em] text-white disabled:opacity-45"
            >
              {busy ? "Submitting…" : "Submit request now"}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.08] bg-[#0E1016]/80 px-4 py-3 text-sm text-white/65">
          {sent ? (
            <p>
              Checkr invitation marked as sent. Open the email from Checkr and complete every step within{" "}
              <span className="font-semibold text-white">7 days</span>.
            </p>
          ) : (
            <p>
              Invite requested{" "}
              {inviteRequestedAt ? new Date(inviteRequestedAt).toLocaleString() : ""}. Match Fit support will send your
              Checkr email shortly; you will receive a notification when it goes out.
            </p>
          )}
        </div>
      )}

      {sent && bgStatus === "PENDING" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void reportComplete()}
          className="flex min-h-[2.75rem] w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:border-white/25 disabled:opacity-50"
        >
          {busy ? "Saving…" : "I completed Checkr screening"}
        </button>
      ) : null}

      {message ? <p className="text-sm text-emerald-200/90">{message}</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <p className="text-xs text-white/45">
        Questions?{" "}
        <a href="mailto:support@match-fit.net" className="text-[#FF7E00] underline">
          support@match-fit.net
        </a>
      </p>
    </div>
  );
}
