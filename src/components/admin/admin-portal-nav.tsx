import Link from "next/link";
import { adminNavLinkActiveClass, adminNavLinkClass } from "@/components/admin/admin-portal-ui";

export function AdminPortalNav(props: {
  current: "dashboard" | "settings" | "assistant" | "waitlists" | "outreach" | "content-calendar" | "ad-tracking";
}) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Admin portal">
      <Link href="/admin" className={props.current === "dashboard" ? adminNavLinkActiveClass : adminNavLinkClass}>
        Dashboard
      </Link>
      <Link
        href="/admin/outreach"
        className={props.current === "outreach" ? adminNavLinkActiveClass : adminNavLinkClass}
      >
        Outreach HQ
      </Link>
      <Link
        href="/admin/content-calendar"
        className={props.current === "content-calendar" ? adminNavLinkActiveClass : adminNavLinkClass}
      >
        Content Calendar
      </Link>
      <Link
        href="/admin/ad-tracking"
        className={props.current === "ad-tracking" ? adminNavLinkActiveClass : adminNavLinkClass}
      >
        Ad Tracking
      </Link>
      <Link href="/admin/settings" className={props.current === "settings" ? adminNavLinkActiveClass : adminNavLinkClass}>
        Settings
      </Link>
      <Link
        href="/admin/assistant"
        className={props.current === "assistant" ? adminNavLinkActiveClass : adminNavLinkClass}
      >
        AI Assistant
      </Link>
      <Link
        href="/admin/beta-waitlists"
        className={props.current === "waitlists" ? adminNavLinkActiveClass : adminNavLinkClass}
      >
        Beta waitlists
      </Link>
    </nav>
  );
}
