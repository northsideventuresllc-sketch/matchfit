import { redirect } from "next/navigation";

/**
 * Superseded by the v2 shell's Pending tab — Pending is now a real workflow_stage with its own tab
 * instead of a standalone page. This redirect keeps the old URL working (it may still be bookmarked
 * or linked) by landing on the same tab via the v2 page's initialTab query param.
 */
export default function AdminContentCalendarPendingPage() {
  redirect("/admin/content-calendar/v2?tab=pending");
}
