"use client";

import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  stars: number;
  testimonialText: string | null;
  testimonialModeratedAt: string | null;
  createdAt: string;
  removedByClientAt: string | null;
  trainerRemovalRequestedAt: string | null;
  inPublicWindow: boolean;
  clientUsername: string;
  clientDisplayName: string;
};

type Payload = {
  visible: Row[];
  archived: Row[];
  profileAverageStars: number | null;
  profileWindowCount: number;
};

export function TrainerReviewsDashboardClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/trainer/reviews");
      const json = (await res.json()) as Payload & { error?: string };
      if (!res.ok) {
        setErr(json.error ?? "Could not load reviews.");
        return;
      }
      setData({
        visible: json.visible ?? [],
        archived: json.archived ?? [],
        profileAverageStars: json.profileAverageStars ?? null,
        profileWindowCount: json.profileWindowCount ?? 0,
      });
    } catch {
      setErr("Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function requestRemoval(reviewId: string) {
    if (!window.confirm("Send this client a polite in-app notice asking them to edit or remove their review?")) {
      return;
    }
    setBusyId(reviewId);
    setErr(null);
    try {
      const res = await fetch(`/api/trainer/reviews/${encodeURIComponent(reviewId)}/request-removal`, {
        method: "POST",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(json.error ?? "Could not send request.");
        return;
      }
      await load();
    } catch {
      setErr("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  function ReviewCard(props: { row: Row; showRequestRemoval: boolean }) {
    const { row } = props;
    const lowStars = row.stars <= 2;
    return (
      <li className="rounded-2xl border border-white/[0.08] bg-[#12151C]/90 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#FF7E00]/90">
              {row.stars}★ · @{row.clientUsername}
            </p>
            <p className="mt-1 text-xs text-white/45">{row.clientDisplayName}</p>
          </div>
          <p className="text-[10px] uppercase tracking-wide text-white/35">
            {new Date(row.createdAt).toLocaleDateString()}
          </p>
        </div>
        {row.testimonialText?.trim() ? (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/82">{row.testimonialText.trim()}</p>
        ) : (
          <p className="mt-3 text-xs italic text-white/40">No published testimonial text for this entry.</p>
        )}
        {row.testimonialModeratedAt ? (
          <p className="mt-2 text-xs text-amber-200/90">
            Match Fit removed written content that did not meet publishing guidelines. The star rating may still show on
            your Public Window when applicable.
          </p>
        ) : null}
        {row.trainerRemovalRequestedAt ? (
          <p className="mt-2 text-xs text-white/50">You already asked this client to update or remove this review.</p>
        ) : null}
        {props.showRequestRemoval && lowStars && !row.removedByClientAt ? (
          <button
            type="button"
            disabled={busyId === row.id || Boolean(row.trainerRemovalRequestedAt)}
            onClick={() => void requestRemoval(row.id)}
            className="mt-4 w-full rounded-xl border border-white/18 bg-white/[0.05] px-3 py-2 text-[11px] font-black uppercase tracking-[0.1em] text-white/75 transition hover:border-white/30 hover:text-white disabled:opacity-40 sm:w-auto"
          >
            {busyId === row.id ? "Sending…" : "Ask client to edit or remove"}
          </button>
        ) : null}
      </li>
    );
  }

  if (loading) {
    return <p className="text-sm text-white/50">Loading reviews…</p>;
  }
  if (err) {
    return <p className="text-sm text-red-300/95">{err}</p>;
  }
  if (!data) {
    return null;
  }

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-black uppercase tracking-[0.08em] text-white sm:text-3xl">CLIENT REVIEWS</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          Your public profile shows up to ten recent reviews and a rolling average. Older non-removed reviews stay in
          your archive here. Only clients can delete a review—you can request a change once per one- or two-star review.
        </p>
        {data.profileAverageStars != null && data.profileWindowCount > 0 ? (
          <p className="mt-4 inline-flex rounded-full border border-[#FFD34E]/35 bg-[#FFD34E]/[0.1] px-4 py-2 text-sm font-black text-[#FFD34E]">
            {data.profileAverageStars.toFixed(1)}★ trainer · {data.profileWindowCount} in Public Window
          </p>
        ) : (
          <p className="mt-4 text-sm text-white/45">You do not have published reviews in the ten-review Public Window yet.</p>
        )}
      </header>

      <section>
        <h2 className="text-xs font-black uppercase tracking-[0.16em] text-white/40">On your public profile</h2>
        {data.visible.length === 0 ? (
          <p className="mt-3 text-sm text-white/45">No reviews in the current Public Window.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {data.visible.map((row) => (
              <ReviewCard key={row.id} row={row} showRequestRemoval />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xs font-black uppercase tracking-[0.16em] text-white/40">Archived (not on public profile)</h2>
        <p className="mt-2 text-xs text-white/45">
          These are kept for your records once they roll past the latest ten client-visible reviews.
        </p>
        {data.archived.length === 0 ? (
          <p className="mt-3 text-sm text-white/45">No archived reviews yet.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {data.archived.map((row) => (
              <ReviewCard key={row.id} row={row} showRequestRemoval />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
