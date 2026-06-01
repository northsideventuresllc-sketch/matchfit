import Link from "next/link";

const linkClass =
  "rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white/75 hover:bg-white/[0.08]";

export function AdminPortalNav(props: { current: "dashboard" | "settings" | "assistant" | "waitlists" }) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Admin portal">
      <Link href="/admin" className={props.current === "dashboard" ? `${linkClass} border-cyan-400/40 text-cyan-100` : linkClass}>
        Dashboard
      </Link>
      <Link
        href="/admin/settings"
        className={props.current === "settings" ? `${linkClass} border-cyan-400/40 text-cyan-100` : linkClass}
      >
        Settings
      </Link>
      <Link
        href="/admin/assistant"
        className={props.current === "assistant" ? `${linkClass} border-cyan-400/40 text-cyan-100` : linkClass}
      >
        AI Assistant
      </Link>
      <Link
        href="/admin/beta-waitlists"
        className={props.current === "waitlists" ? `${linkClass} border-cyan-400/40 text-cyan-100` : linkClass}
      >
        Beta waitlists
      </Link>
    </nav>
  );
}
