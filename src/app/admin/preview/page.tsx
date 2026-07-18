import Link from "next/link";
import {
  AdminPortalBackdrop,
  adminPanelClass,
} from "@/components/admin/admin-portal-ui";

/** Public preview index — no admin auth. Links to the interactive Match Fit previews. */
export default function AdminPreviewIndexPage() {
  const previews = [
    {
      href: "/admin/content-calendar/preview",
      eyebrow: "Content",
      title: "Content Calendar",
      description:
        "Full-caption editing, ADJUST chat bubbles, SAVE EDITS, reversible approve, and the SCHEDULE → OPTIMIZE → PUBLISH flow with platform pickers by asset type. Scheduled + Impromptu content hub.",
    },
    {
      href: "/admin/outreach/preview",
      eyebrow: "Outreach",
      title: "Outreach HQ",
      description:
        "The morning pack: 5 Instagram + 5 email leads. DM, comment, and post links; email rendered as it lands in a client with the locked Match Fit signature. Approve / deny / adjust each lead.",
    },
  ];

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] px-5 py-10 text-white sm:px-8 sm:py-12">
      <AdminPortalBackdrop />
      <div className="relative mx-auto max-w-4xl space-y-8">
        <header className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#FF7E00]">Match Fit preview</p>
          <h1 className="text-4xl font-black tracking-tight">Interactive previews</h1>
          <div className="rounded-2xl border border-amber-400/40 bg-amber-500/[0.08] px-4 py-3 text-sm leading-relaxed text-amber-100">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-300">Preview environment</p>
            <p className="mt-1 text-amber-100/90">
              These are interactive UI previews of Match Fit&apos;s Content Calendar and Outreach HQ. They run on demo
              data only — <strong>production is unchanged</strong> and all <strong>automations are on HOLD</strong>.
              Nothing publishes or sends: queues do not fire until JB says fire.
            </p>
          </div>
        </header>

        <div className="grid gap-5 sm:grid-cols-2">
          {previews.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className={`${adminPanelClass} group flex flex-col gap-3 p-6 transition hover:border-[#FF7E00]/40`}
            >
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#FF7E00]">{p.eyebrow}</span>
              <span className="text-2xl font-black tracking-tight text-white group-hover:text-[#FFD34E]">
                {p.title}
              </span>
              <span className="text-sm leading-relaxed text-white/55">{p.description}</span>
              <span className="mt-auto inline-flex items-center gap-1 text-sm font-bold text-[#FFD34E]">
                Open preview <span aria-hidden>→</span>
              </span>
            </Link>
          ))}
        </div>

        <p className="text-center text-xs text-white/40">
          Production tools live behind admin login at{" "}
          <span className="font-semibold text-white/60">/admin/content-calendar</span> and{" "}
          <span className="font-semibold text-white/60">/admin/outreach</span>.
        </p>
      </div>
    </main>
  );
}
