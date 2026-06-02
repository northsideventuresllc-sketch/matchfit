import Link from "next/link";
import { adminNavLinkActiveClass, adminNavLinkClass } from "@/components/admin/admin-portal-ui";

export function AdminPortalNav(props: { current: "dashboard" | "settings" | "assistant" | "waitlists" }) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Admin portal">
      <Link href="/admin" className={props.current === "dashboard" ? adminNavLinkActiveClass : adminNavLinkClass}>
        Dashboard
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
