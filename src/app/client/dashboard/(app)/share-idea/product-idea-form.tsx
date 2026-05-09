"use client";

import { FormEvent, useState } from "react";

const CATEGORIES = [
  { value: "NEW_FEATURE", label: "New Feature" },
  { value: "UX_OR_DESIGN", label: "UX or Design" },
  { value: "MATCHING_OR_DISCOVERY", label: "Matching or Discovery" },
  { value: "MESSAGING_OR_CHAT", label: "Messaging or Chat" },
  { value: "FIT_HUB_OR_SOCIAL", label: "Fit Hub or Social" },
  { value: "BILLING_OR_PAYMENTS", label: "Billing or Payments" },
  { value: "TRAINER_TOOLS", label: "Trainer Tools" },
  { value: "CLIENT_TOOLS", label: "Client Tools" },
  { value: "OTHER", label: "Other" },
] as const;

export function ProductIdeaForm() {
  const [anonymous, setAnonymous] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0].value);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/product-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anonymous,
          name,
          email,
          category,
          description,
        }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not send your idea.");
        return;
      }
      setOk(data.message ?? "Thanks — we received your idea. Our team reviews submissions regularly.");
      setDescription("");
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-5">
      {error ? (
        <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100" role="status">
          {ok}
        </p>
      ) : null}

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-white/90">Your Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={anonymous}
          placeholder={anonymous ? "Anonymous Selected" : "Full Name"}
          className="w-full rounded-xl border border-white/10 bg-[#0E1016] px-3 py-2 text-sm text-white outline-none ring-[#FF7E00]/30 focus-visible:ring-2 disabled:opacity-60"
        />
      </label>

      <label className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#0E1016]/40 px-3 py-2 text-sm text-white/80">
        <input
          type="checkbox"
          checked={anonymous}
          onChange={(e) => setAnonymous(e.target.checked)}
          className="h-4 w-4 accent-[#FF7E00]"
        />
        Submit as Anonymous
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-white/90">Email Address</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-xl border border-white/10 bg-[#0E1016] px-3 py-2 text-sm text-white outline-none ring-[#FF7E00]/30 focus-visible:ring-2"
          required
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-white/90">Category</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-[#0E1016] px-3 py-2 text-sm text-white outline-none ring-[#FF7E00]/30 focus-visible:ring-2"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-white/90">Your Idea</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          maxLength={5000}
          placeholder="Describe what would help you or others. Include context (where in the app, how you’d use it)."
          className="w-full resize-y rounded-xl border border-white/10 bg-[#0E1016] px-3 py-2 text-sm text-white outline-none ring-[#FF7E00]/30 focus-visible:ring-2"
          required
        />
        <p className="text-right text-[10px] text-white/35">{description.length}/5000</p>
      </label>

      <div className="flex justify-center">
        <button
          type="submit"
          disabled={saving}
          className="group relative isolate flex min-h-[3rem] w-full max-w-md items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50"
        >
          <span aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]" />
          <span className="relative">{saving ? "Sending…" : "Submit Idea"}</span>
        </button>
      </div>
    </form>
  );
}
