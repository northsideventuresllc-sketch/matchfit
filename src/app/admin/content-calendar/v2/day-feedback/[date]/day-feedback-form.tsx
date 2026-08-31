"use client";

import { useState, type FormEvent } from "react";
import { adminInputClass, adminLabelClass, adminPrimaryButtonClass } from "@/components/admin/admin-portal-ui";

/**
 * Client half of the day-feedback page — the server page handles the admin-session gate and date
 * formatting, this just owns the textarea + submit state. Posts to the matching API route
 * (`/api/admin/content-calendar/v2/day-feedback/[date]`), matching the client-fetch-to-API-route
 * pattern already used by every other content-calendar v2 panel (no server actions in this repo).
 */
export function DayFeedbackForm({ postDate }: { postDate: string }) {
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = feedback.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/content-calendar/v2/day-feedback/${encodeURIComponent(postDate)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: trimmed }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "Could not save feedback.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Could not save feedback. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-[#12151C]/90 p-5 text-sm leading-relaxed text-white/80">
        Thanks — this has been recorded.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="day-feedback-text" className={adminLabelClass}>
          Feedback
        </label>
        <textarea
          id="day-feedback-text"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={6}
          placeholder="What should the next generation run do differently for this day?"
          className={`${adminInputClass} resize-y`}
          disabled={submitting}
        />
      </div>

      {error ? <p className="text-xs font-semibold text-[#FFB4B4]">{error}</p> : null}

      <button type="submit" className={adminPrimaryButtonClass} disabled={submitting || !feedback.trim()}>
        {submitting ? "Submitting…" : "Submit Feedback"}
      </button>
    </form>
  );
}
