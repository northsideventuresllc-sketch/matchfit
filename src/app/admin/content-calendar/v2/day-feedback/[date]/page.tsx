import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/require-admin";
import { DayFeedbackForm } from "./day-feedback-form";

/** "Monday, September 1, 2026" from a YYYY-MM-DD date, or the raw string if it doesn't parse. */
function formatPostDateLabel(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Reached only via the day-scheduled ETA / all-posted confirmation emails (Phase A1's
 * content-calendar-cowork-orchestration.ts) — a lightweight, chrome-light feedback form for one
 * content day, no AdminPortalShell. Server-rendered, admin-session-gated (matches other lightweight
 * admin pages, e.g. /admin/assistant, via requireAdminSession()). The textarea + submit are in the
 * client half (day-feedback-form.tsx), which posts to the matching API route.
 */
export default async function DayFeedbackPage({ params }: { params: Promise<{ date: string }> }) {
  const sess = await requireAdminSession();
  if (!sess) redirect("/admin/login");

  const { date } = await params;
  const dateLabel = formatPostDateLabel(date);

  return (
    <div className="min-h-screen bg-[#0B0D12] px-4 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#FFD34E]">Day Feedback</p>
        <h1 className="mt-2 text-2xl font-black text-white">{dateLabel}</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/60">
          Leave feedback on this day&apos;s content for the next generation run.
        </p>

        <div className="mt-6">
          <DayFeedbackForm postDate={date} />
        </div>
      </div>
    </div>
  );
}
