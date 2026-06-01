import Link from "next/link";

const NAV_ITEMS = [
  { id: "dashboard" as const, label: "Dashboard", href: "/admin", icon: "⬛" },
  { id: "settings" as const, label: "Settings", href: "/admin/settings", icon: "⚙" },
  { id: "assistant" as const, label: "AI Assistant", href: "/admin/assistant", icon: "✦" },
  { id: "waitlists" as const, label: "Beta Waitlists", href: "/admin/beta-waitlists", icon: "◈" },
];

export function AdminPortalNav(props: { current: "dashboard" | "settings" | "assistant" | "waitlists" }) {
  return (
    <nav className="flex flex-wrap gap-1" aria-label="Admin portal">
      {NAV_ITEMS.map((item) => {
        const isActive = props.current === item.id;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={`group relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-[11px] font-semibold tracking-wide transition-all ${
              isActive
                ? "bg-cyan-500/15 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.3)]"
                : "text-white/55 hover:bg-white/[0.06] hover:text-white/85"
            }`}
          >
            <span
              className={`text-[10px] ${isActive ? "text-cyan-400" : "text-white/30 group-hover:text-white/50"}`}
              aria-hidden
            >
              {item.icon}
            </span>
            {item.label}
            {isActive && (
              <span
                aria-hidden
                className="absolute bottom-0 left-1/2 h-px w-3/4 -translate-x-1/2 rounded-full bg-cyan-400/50"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
