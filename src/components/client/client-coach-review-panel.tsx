"use client";

import { useCallback, useEffect, useState } from "react";

type ReviewState = {
  id: string;
  stars: number;
  testimonialText: string | null;
  testimonialModeratedAt: string | null;
  trainerRemovalRequestedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function ClientCoachReviewPanel(props: { trainerUsername: string }) {
  const [eligible, setEligible] = useState(false);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [editing, setEditing] = useState(true);
  const [stars, setStars] = useState(5);
  const [testimonial, setTestimonial] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/client/trainers/${encodeURIComponent(props.trainerUsername)}/review`);
      const data = (await res.json()) as {
        eligible?: boolean;
        review?: ReviewState | null;
        error?: string;
      };
      if (!res.ok) {
        setErr(data.error ?? "Could not load review.");
        return;
      }
      setEligible(Boolean(data.eligible));
      const r = data.review ?? null;
      setReview(r);
      if (r) {
        setStars(r.stars);
        setTestimonial(r.testimonialText ?? "");
        setEditing(false);
      } else {
        setEditing(true);
        setStars(5);
        setTestimonial("");
      }
    } catch {
      setErr("Network error.");
    } finally {
      setLoading(false);
    }
  }, [props.trainerUsername]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  function enterEditFromPosted() {
    if (!review) return;
    setStars(review.stars);
    setTestimonial(review.testimonialText ?? "");
    setErr(null);
    setOkMsg(null);
    setEditing(true);
  }

  function cancelEdit() {
    if (review) {
      setStars(review.stars);
      setTestimonial(review.testimonialText ?? "");
      setEditing(false);
    }
    setErr(null);
  }

  async function save() {
    setSaving(true);
    setErr(null);
    setOkMsg(null);
    try {
      const res = await fetch(`/api/client/trainers/${encodeURIComponent(props.trainerUsername)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stars,
          testimonial: testimonial.trim() ? testimonial.trim() : null,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        review?: ReviewState;
        testimonialModerated?: boolean;
        fiveStarTokensGranted?: boolean;
      };
      if (!res.ok) {
        setErr(data.error ?? "Could not save.");
        return;
      }
      if (data.review) {
        setReview(data.review);
        setStars(data.review.stars);
        setTestimonial(data.review.testimonialText ?? "");
      }
      let msg = "Your review is posted on this coach's profile when it's in their latest ten.";
      if (data.testimonialModerated) {
        setTestimonial("");
        msg =
          "Your star rating was posted. Part of your testimonial could not be published under Match Fit guidelines, so it was not shown.";
      }
      if (data.fiveStarTokensGranted) {
        msg = `${msg} Your coach received bonus promo tokens for your five-star review.`;
      }
      setOkMsg(msg);
      setEditing(false);
    } catch {
      setErr("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("Remove your public review for this coach? You can write a new one later if you are eligible.")) {
      return;
    }
    setSaving(true);
    setErr(null);
    setOkMsg(null);
    try {
      const res = await fetch(`/api/client/trainers/${encodeURIComponent(props.trainerUsername)}/review`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Could not remove.");
        return;
      }
      setReview(null);
      setStars(5);
      setTestimonial("");
      setEditing(true);
      setOkMsg("Your review was removed.");
    } catch {
      setErr("Network error.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-white/50" id="coach-review">
        Loading review…
      </p>
    );
  }

  if (!eligible) {
    return (
      <div id="coach-review" className="rounded-2xl border border-white/[0.08] bg-[#0E1016]/80 p-5">
        <h3 className="text-xs font-black uppercase tracking-[0.16em] text-white/40">Your review</h3>
        <p className="mt-3 text-sm leading-relaxed text-white/55">
          After you message this coach here on Match Fit or complete a booked session with them, you can leave a star
          rating and optional testimonial.
        </p>
      </div>
    );
  }

  const showPosted = Boolean(review) && !editing;

  return (
    <div id="coach-review" className="rounded-2xl border border-white/[0.08] bg-[#0E1016]/80 p-5 sm:p-6">
      <h3 className="text-xs font-black uppercase tracking-[0.16em] text-[#FF7E00]/90">
        {showPosted ? "Your review" : review ? "Edit your review" : "Leave a review"}
      </h3>
      {!showPosted ? (
        <p className="mt-2 text-xs leading-relaxed text-white/45">
          1–5 stars. Testimonials are public on this profile when they are among this coach&apos;s latest reviews. Match
          Fit may remove wording that violates safety or off-platform contact rules.
        </p>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-white/45">
          Posted — it appears on this profile when it&apos;s among this coach&apos;s latest ten reviews. Hover this card
          for <span className="text-white/70">Change</span> or <span className="text-white/70">Remove</span>, or focus
          it with the keyboard to show the same actions.
        </p>
      )}

      {review?.trainerRemovalRequestedAt ? (
        <p className="mt-4 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100/95">
          This coach asked you to edit or remove this review. Update it and save, or remove it entirely—only you can
          delete your review.
        </p>
      ) : null}

      {showPosted && review ? (
        <div
          tabIndex={0}
          role="region"
          aria-label="Your posted review. Hover or focus to change or remove."
          className="group mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-4 outline-none transition-colors hover:border-emerald-400/45 focus-visible:ring-2 focus-visible:ring-[#FF7E00]/55"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-200/95">Posted</p>
            <div className="flex shrink-0 gap-2 opacity-45 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
              <button
                type="button"
                disabled={saving}
                onClick={() => enterEditFromPosted()}
                className="rounded-lg border border-white/20 bg-white/[0.08] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-white/90 transition hover:border-[#FF7E00]/50 hover:bg-white/[0.12] disabled:opacity-40"
              >
                Change
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void remove()}
                className="rounded-lg border border-red-400/35 bg-red-500/[0.12] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-red-100/95 transition hover:border-red-400/55 hover:bg-red-500/[0.18] disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-1.5" aria-label={`${review.stars} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                className={`text-lg leading-none ${n <= review.stars ? "text-[#FFD34E]" : "text-white/20"}`}
                aria-hidden
              >
                ★
              </span>
            ))}
            <span className="ml-2 text-sm font-semibold text-white/70">{review.stars} / 5</span>
          </div>

          {review.testimonialText?.trim() ? (
            <blockquote className="mt-4 border-l-2 border-white/20 pl-4 text-sm leading-relaxed text-white/85">
              {review.testimonialText.trim()}
            </blockquote>
          ) : (
            <p className="mt-4 text-sm italic text-white/40">No testimonial text — star rating only.</p>
          )}
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-white/40">Stars</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                disabled={saving}
                onClick={() => setStars(n)}
                className={`h-10 min-w-[2.5rem] rounded-xl text-sm font-black transition ${
                  stars >= n
                    ? "bg-[linear-gradient(135deg,#FF7E00_0%,#E32B2B_100%)] text-white shadow-[0_8px_24px_-12px_rgba(255,126,0,0.45)]"
                    : "border border-white/15 bg-white/[0.04] text-white/35 hover:border-white/25 hover:text-white/60"
                }`}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
              >
                ★
              </button>
            ))}
          </div>

          <label className="mt-6 block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-white/40">Testimonial (optional)</span>
            <textarea
              value={testimonial}
              onChange={(e) => setTestimonial(e.target.value)}
              disabled={saving}
              rows={4}
              maxLength={1200}
              placeholder="What stood out about training with this coach?"
              className="mt-2 w-full resize-y rounded-xl border border-white/12 bg-[#07080C]/90 px-3 py-2.5 text-sm text-white/90 outline-none ring-0 placeholder:text-white/30 focus:border-[#FF7E00]/50"
            />
          </label>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="inline-flex min-h-[2.75rem] flex-1 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FF7E00_0%,#E32B2B_100%)] px-4 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {saving ? "Saving…" : review ? "Save changes" : "Post review"}
            </button>
            {review ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => cancelEdit()}
                className="inline-flex min-h-[2.75rem] flex-1 items-center justify-center rounded-xl border border-white/18 bg-transparent px-4 text-xs font-black uppercase tracking-[0.12em] text-white/70 transition hover:border-white/30 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </>
      )}

      {err ? <p className="mt-3 text-sm text-red-300/95">{err}</p> : null}
      {okMsg ? <p className="mt-3 text-sm text-emerald-200/90">{okMsg}</p> : null}
    </div>
  );
}
