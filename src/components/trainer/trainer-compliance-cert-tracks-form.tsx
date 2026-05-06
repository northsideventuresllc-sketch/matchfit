"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { FormEvent, MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { SPECIALIST_ROLE_OPTIONS } from "@/lib/trainer-specialist-roles";

function isLockedStatus(status: string | null | undefined): boolean {
  const s = (status ?? "NOT_STARTED").trim().toUpperCase();
  return s === "APPROVED" || s === "PENDING";
}

type Props = {
  initialTrackCpt: boolean;
  initialTrackNutrition: boolean;
  initialTrackSpecialist: boolean;
  initialSpecialistRole: string | null;
  certificationReviewStatus: string;
  nutritionistCertificationReviewStatus: string;
  specialistCertificationReviewStatus: string;
};

export function TrainerComplianceCertTracksForm(props: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [trackCpt, setTrackCpt] = useState(props.initialTrackCpt);
  const [trackNutrition, setTrackNutrition] = useState(props.initialTrackNutrition);
  const [trackSpecialist, setTrackSpecialist] = useState(props.initialTrackSpecialist);
  const [specialistRole, setSpecialistRole] = useState<string>(props.initialSpecialistRole ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [leaveModal, setLeaveModal] = useState<{ href: string } | null>(null);

  const cptLockedOff = props.initialTrackCpt && isLockedStatus(props.certificationReviewStatus);
  const nutLockedOff = props.initialTrackNutrition && isLockedStatus(props.nutritionistCertificationReviewStatus);
  const specLockedOff = props.initialTrackSpecialist && isLockedStatus(props.specialistCertificationReviewStatus);

  const cptDisabled = trackSpecialist || (props.initialTrackCpt && isLockedStatus(props.certificationReviewStatus));
  const specialistDisabled =
    trackCpt || (props.initialTrackSpecialist && isLockedStatus(props.specialistCertificationReviewStatus));

  const specialistRoleInvalid = trackSpecialist && !SPECIALIST_ROLE_OPTIONS.some((o) => o.id === specialistRole);

  const initialSerialized = useMemo(
    () =>
      JSON.stringify({
        trackCpt: props.initialTrackCpt,
        trackNutrition: props.initialTrackNutrition,
        trackSpecialist: props.initialTrackSpecialist,
        specialistRole: props.initialTrackSpecialist ? props.initialSpecialistRole : null,
      }),
    [
      props.initialTrackCpt,
      props.initialTrackNutrition,
      props.initialTrackSpecialist,
      props.initialSpecialistRole,
    ],
  );

  const dirty = useMemo(() => {
    const roleOk =
      trackSpecialist && SPECIALIST_ROLE_OPTIONS.some((o) => o.id === specialistRole) ? specialistRole : null;
    return (
      JSON.stringify({
        trackCpt,
        trackNutrition,
        trackSpecialist,
        specialistRole: trackSpecialist ? roleOk : null,
      }) !== initialSerialized
    );
  }, [trackCpt, trackNutrition, trackSpecialist, specialistRole, initialSerialized]);

  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    function onClickCapture(e: Event) {
      const el = (e.target as HTMLElement | null)?.closest?.("a[href]");
      if (!el) return;
      const href = el.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveModal({ href: url.pathname + url.search + url.hash });
    }
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [dirty, pathname]);

  async function saveTracks(): Promise<boolean> {
    setError(null);
    setOk(null);
    if (trackSpecialist && !SPECIALIST_ROLE_OPTIONS.some((o) => o.id === specialistRole)) {
      setError("Select which specialist role applies when that path is enabled.");
      return false;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/trainer/compliance/certification-tracks", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackCpt,
          trackNutrition,
          trackSpecialist,
          specialistRole: trackSpecialist ? specialistRole : null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save.");
        return false;
      }
      setOk("Saved. Upload or refresh files from onboarding if needed.");
      router.refresh();
      return true;
    } catch {
      setError("Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await saveTracks();
  }

  async function handleLeaveSave() {
    const saved = await saveTracks();
    if (!saved) return;
    const href = leaveModal?.href;
    setLeaveModal(null);
    if (href) router.push(href);
  }

  function handleLeaveDiscard() {
    const href = leaveModal?.href;
    setLeaveModal(null);
    if (href) router.push(href);
  }

  function guardedLeave(e: MouseEvent<HTMLAnchorElement>, href: string) {
    if (!dirty) return;
    e.preventDefault();
    setLeaveModal({ href });
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 rounded-2xl border border-white/[0.08] bg-[#0E1016]/50 p-5 sm:p-6">
      <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">Credential paths on file</h3>
      <p className="mt-2 text-xs leading-relaxed text-white/50">
        Opt in to each credential type Match Fit should verify for your account. CPT and the certified specialist path
        cannot both be on at the same time. After you save, upload PDFs or images from{" "}
        <Link
          href="/trainer/onboarding"
          onClick={(e) => guardedLeave(e, "/trainer/onboarding")}
          className="font-semibold text-[#FF7E00] underline-offset-2 hover:underline"
        >
          onboarding
        </Link>{" "}
        (certifications step) unless you already have an approved file on record.
      </p>

      {error ? (
        <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100" role="status">
          {ok}
        </p>
      ) : null}

      <div className="mt-5 space-y-4">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-[#12151C]/80 px-4 py-3">
          <input
            type="checkbox"
            checked={trackCpt}
            disabled={cptDisabled}
            onChange={(e) => {
              setTrackCpt(e.target.checked);
              if (e.target.checked) setTrackSpecialist(false);
            }}
            className="mt-1 h-4 w-4 accent-[#FF7E00] disabled:opacity-40"
          />
          <span className="text-sm text-white/80">
            <span className="font-semibold text-white">Certified Personal Trainer (CPT)</span>
            <span className="mt-1 block text-xs text-white/45">
              Primary personal-training credential (NCCA-style CPT issuers).
            </span>
            {cptLockedOff ? (
              <span className="mt-1 block text-[11px] text-amber-200/90">Cannot turn off while a CPT file is pending or approved.</span>
            ) : null}
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-[#12151C]/80 px-4 py-3">
          <input
            type="checkbox"
            checked={trackNutrition}
            disabled={nutLockedOff && trackNutrition}
            onChange={(e) => setTrackNutrition(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[#FF7E00] disabled:opacity-40"
          />
          <span className="text-sm text-white/80">
            <span className="font-semibold text-white">Nutrition — RDN / RD and related credentials</span>
            <span className="mt-1 block text-xs text-white/45">
              Includes RDN, CNC, CNS, Precision Nutrition, and other recognized nutrition certifications.
            </span>
            {nutLockedOff ? (
              <span className="mt-1 block text-[11px] text-amber-200/90">
                Cannot turn off while a nutrition file is pending or approved.
              </span>
            ) : null}
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-[#12151C]/80 px-4 py-3">
          <input
            type="checkbox"
            checked={trackSpecialist}
            disabled={specialistDisabled}
            onChange={(e) => {
              setTrackSpecialist(e.target.checked);
              if (e.target.checked) setTrackCpt(false);
            }}
            className="mt-1 h-4 w-4 accent-[#FF7E00] disabled:opacity-40"
          />
          <span className="text-sm text-white/80">
            <span className="font-semibold text-white">Certified fitness specialist (CPT alternative)</span>
            <span className="mt-1 block text-xs text-white/45">CSCS®, corrective exercise specialty, or accredited group fitness.</span>
            {specLockedOff ? (
              <span className="mt-1 block text-[11px] text-amber-200/90">
                Cannot turn off while a specialist file is pending or approved.
              </span>
            ) : null}
          </span>
        </label>

        {trackSpecialist ? (
          <div className="pl-1">
            <label htmlFor="compliance-specialist-role" className="text-xs font-semibold uppercase tracking-wide text-white/45">
              Specialist role
            </label>
            <select
              id="compliance-specialist-role"
              value={specialistRole}
              onChange={(e) => setSpecialistRole(e.target.value)}
              className="mt-2 w-full max-w-md rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-sm text-white outline-none ring-[#FF7E00]/40 focus:border-[#FF7E00]/40 focus:ring-2"
            >
              <option value="">Select role…</option>
              {SPECIALIST_ROLE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            {specialistRoleInvalid ? (
              <p className="mt-1 text-[11px] text-amber-200/90">Choose the role that matches the credential you will upload.</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={busy || !dirty || specialistRoleInvalid}
          className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-[#FF7E00]/45 bg-[#FF7E00]/16 px-5 text-xs font-black uppercase tracking-wide text-white transition hover:border-[#FF7E00]/60 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save credential paths"}
        </button>
      </div>

      {leaveModal ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-compliance-tracks-title"
        >
          <div className="max-w-md rounded-2xl border border-white/10 bg-[#12151C] p-6 shadow-2xl">
            <h2 id="leave-compliance-tracks-title" className="text-lg font-black uppercase tracking-wide text-white">
              Unsaved changes
            </h2>
            <p className="mt-3 text-xs font-semibold uppercase leading-relaxed tracking-wide text-white/55 sm:text-sm">
              Save credential paths before leaving, or discard changes and continue. Cancel stays on this page.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleLeaveSave()}
                className="min-h-[2.75rem] flex-1 rounded-xl border border-[#FF7E00]/40 bg-[#FF7E00]/15 px-4 text-xs font-black uppercase tracking-wide text-white transition hover:bg-[#FF7E00]/25 disabled:opacity-50 sm:text-sm"
              >
                Save &amp; Continue
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleLeaveDiscard}
                className="min-h-[2.75rem] flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 text-xs font-black uppercase tracking-wide text-white/90 transition hover:border-white/25 disabled:opacity-50 sm:text-sm"
              >
                Don&apos;t Save
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setLeaveModal(null)}
                className="min-h-[2.75rem] flex-1 rounded-xl border border-white/10 px-4 text-xs font-black uppercase tracking-wide text-white/55 transition hover:text-white/80 disabled:opacity-50 sm:text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
