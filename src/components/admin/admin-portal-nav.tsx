import Link from "next/link";
import {
  adminPortalNavLinkActiveClass,
  adminPortalNavLinkClass,
  adminPortalNavLinkIdleClass,
} from "@/components/admin/admin-portal-styles";

export type AdminPortalNavPage = "dashboard" | "settings" | "assistant" | "waitlists";

const PAGES: { id: AdminPortalNavPage; href: string; label: string }[] = [
  { id: "dashboard", href: "/admin", label: "Dashboard" },
  { id: "settings", href: "/admin/settings", label: "Settings" },
  { id: "assistant", href: "/admin/assistant", label: "AI Assistant" },
  { id: "waitlists", href: "/admin/beta-waitlists", label: "Beta Waitlists" },
];

function linkClassName(current: AdminPortalNavPage, page: AdminPortalNavPage, variant: "horizontal" | "sidebar") {
  const active = current === page;
  const base = `${adminPortalNavLinkClass} ${active ? adminPortalNavLinkActiveClass : adminPortalNavLinkIdleClass}`;
  if (variant === "sidebar") {
    return `${base} block w-full text-left`;
  }
  return base;
}

export function AdminPortalNav(props: { current: AdminPortalNavPage; variant?: "horizontal" | "sidebar" }) {
  const variant = props.variant ?? "horizontal";

  return (
    <nav
      className={variant === "sidebar" ? "flex flex-col gap-1" : "flex flex-wrap gap-2"}
      aria-label="Administrator portal"
    >
      {PAGES.map((page) => (
        <Link
          key={page.id}
          href={page.href}
          className={linkClassName(props.current, page.id, variant)}
          aria-current={props.current === page.id ? "page" : undefined}
        >
          {page.label}
        </Link>
      ))}
    </nav>
  );
}
