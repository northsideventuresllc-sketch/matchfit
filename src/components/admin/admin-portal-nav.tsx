import Link from "next/link";
import {
  adminPortalNavLinkActiveClass,
  adminPortalNavLinkClass,
  adminPortalNavLinkIdleClass,
} from "@/components/admin/admin-portal-styles";
import {
  MATCH_FIT_DEFAULT_ADS_SURFACE_LABEL,
  MATCH_FIT_DEFAULT_ADS_SURFACE_PATH,
} from "@/lib/match-fit-ads-surface";

export type AdminPortalNavPage =
  | "dashboard"
  | "support-inbox"
  | "settings"
  | "assistant"
  | "waitlists"
  | "outreach"
  | "content-calendar"
  | "ad-tracking"
  | "email-templates"
  | "fp-documents";

/** Ad Tracking HQ sits near the top — admin is the default Match Fit ads surface. */
const PAGES: { id: AdminPortalNavPage; href: string; label: string }[] = [
  { id: "dashboard", href: "/admin", label: "Dashboard" },
  { id: "ad-tracking", href: MATCH_FIT_DEFAULT_ADS_SURFACE_PATH, label: MATCH_FIT_DEFAULT_ADS_SURFACE_LABEL },
  { id: "outreach", href: "/admin/outreach/v2", label: "Outreach HQ" },
  { id: "content-calendar", href: "/admin/content-calendar", label: "Content Calendar" },
  { id: "support-inbox", href: "/admin/support-inbox", label: "Support Inbox" },
  { id: "fp-documents", href: "/admin/fp-documents", label: "Fitness Pro Documents" },
  { id: "email-templates", href: "/admin/email-templates", label: "Email Templates" },
  { id: "assistant", href: "/admin/assistant", label: "AI Assistant" },
  { id: "waitlists", href: "/admin/beta-waitlists", label: "Beta Waitlists" },
  { id: "settings", href: "/admin/settings", label: "Settings" },
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
