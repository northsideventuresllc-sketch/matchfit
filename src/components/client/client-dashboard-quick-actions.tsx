"use client";

import Link from "next/link";
import type { ClientDashboardQuickLinkId } from "@/lib/client-dashboard-quick-links";
import { clientQuickLinkOptionById } from "@/lib/client-dashboard-quick-links";

const SETTINGS_QUICK_LINKS_HASH = "#client-quick-links-settings";

function QuickLinkIcon(props: { id: ClientDashboardQuickLinkId; className?: string }) {
  const c = props.className ?? "h-8 w-8 sm:h-9 sm:w-9";
  switch (props.id) {
    case "fithub":
      return (
        <svg viewBox="0 0 64 64" fill="none" className={c} aria-hidden>
          <path
            d="M20 44h24M32 20v24"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.45"
          />
          <rect x="14" y="14" width="36" height="36" rx="8" stroke="currentColor" strokeWidth="2.8" />
        </svg>
      );
    case "daily_questionnaire":
      return (
        <svg viewBox="0 0 64 64" fill="none" className={c} aria-hidden>
          <rect x="14" y="18" width="36" height="34" rx="4" stroke="currentColor" strokeWidth="2.6" />
          <path d="M14 28h36" stroke="currentColor" strokeWidth="2.6" />
          <path d="M26 14v8M38 14v8" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M22 38h10M22 44h20" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case "find_coaches":
      return (
        <svg viewBox="0 0 64 64" fill="none" className={c} aria-hidden>
          <circle cx="28" cy="28" r="14" stroke="currentColor" strokeWidth="2.8" />
          <path d="M38.5 38.5 50 50" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <path d="M22 28h12M28 22v12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case "chats":
      return (
        <svg viewBox="0 0 64 64" fill="none" className={c} aria-hidden>
          <path
            d="M14 22h36a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H28l-10 8v-8h-4a4 4 0 0 1-4-4V26a4 4 0 0 1 4-4Z"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "service_management":
      return (
        <svg viewBox="0 0 64 64" fill="none" className={c} aria-hidden>
          <path
            d="M18 14h28a2 2 0 0 1 2 2v36a2 2 0 0 1-2 2H18a2 2 0 0 1-2-2V16a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth="2.6"
          />
          <path d="M22 24h20M22 34h14M22 44h18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case "preferences":
      return (
        <svg viewBox="0 0 64 64" fill="none" className={c} aria-hidden>
          <circle cx="32" cy="20" r="6" stroke="currentColor" strokeWidth="2.6" />
          <path d="M20 46c2-10 8-14 12-14s10 4 12 14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M44 22l6-4v12l-6-4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "notifications":
      return (
        <svg viewBox="0 0 64 64" fill="none" className={c} aria-hidden>
          <path
            d="M22 26c0-8 6-14 14-14s14 6 14 14v10l4 8H18l4-8V26Z"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          <path d="M26 48h12" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      );
    case "billing":
      return (
        <svg viewBox="0 0 64 64" fill="none" className={c} aria-hidden>
          <rect x="12" y="16" width="40" height="34" rx="4" stroke="currentColor" strokeWidth="2.6" />
          <path d="M12 28h40" stroke="currentColor" strokeWidth="2.6" />
          <path d="M22 38h14M22 44h8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case "notification_settings":
      return (
        <svg viewBox="0 0 64 64" fill="none" className={c} aria-hidden>
          <path
            d="M30 10h4l2 6a18 18 0 0 1 10 6l6-2 2 4-4 4a18 18 0 0 1 0 12l4 4-2 4-6-2a18 18 0 0 1-10 6l-2 6h-4l-2-6a18 18 0 0 1-10-6l-6 2-2-4 4-4a18 18 0 0 1 0-12l-4-4 2-4 6 2a18 18 0 0 1 10-6l2-6Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <circle cx="32" cy="32" r="5" stroke="currentColor" strokeWidth="2.2" />
        </svg>
      );
    case "account_settings":
      return (
        <svg viewBox="0 0 64 64" fill="none" className={c} aria-hidden>
          <circle cx="32" cy="24" r="10" stroke="currentColor" strokeWidth="2.6" />
          <path
            d="M16 54c2-12 10-18 16-18s14 6 16 18"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case "profile":
      return (
        <svg viewBox="0 0 64 64" fill="none" className={c} aria-hidden>
          <circle cx="32" cy="22" r="10" stroke="currentColor" strokeWidth="2.5" />
          <path
            d="M16 52c2-10 10-16 16-16s14 6 16 16"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <rect x="40" y="12" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="2.2" />
          <path d="M44 18h6M47 15v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 64 64" fill="none" className={c} aria-hidden>
          <circle cx="32" cy="32" r="14" stroke="currentColor" strokeWidth="2.8" />
          <path d="M32 24v10M32 40h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
  }
}

export function ClientDashboardQuickActions(props: { quickLinkIds: ClientDashboardQuickLinkId[] }) {
  const ids = props.quickLinkIds.filter((id): id is ClientDashboardQuickLinkId => Boolean(clientQuickLinkOptionById(id)));

  if (ids.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/[0.12] bg-[#0E1016]/40 px-4 py-8 text-center">
        <p className="text-sm leading-relaxed text-white/50">
          No quick links yet. Choose up to four shortcuts that will appear here.
        </p>
        <p className="mt-4">
          <Link
            href={`/client/settings${SETTINGS_QUICK_LINKS_HASH}`}
            className="text-sm font-semibold text-[#FF9A4A] underline-offset-2 transition hover:text-[#FF7E00] hover:underline"
          >
            Customize Quick Links in Account Settings
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <ul className="flex flex-wrap justify-center gap-2.5 sm:gap-4">
        {ids.map((id) => {
          const opt = clientQuickLinkOptionById(id);
          if (!opt) return null;
          return (
            <li key={id} className="w-[calc(50%-0.3125rem)] max-w-[11rem] sm:w-40 sm:max-w-none">
              <Link
                href={opt.href}
                className="group flex h-full min-h-[9.75rem] flex-col items-center justify-between gap-2 rounded-2xl border border-white/[0.08] bg-[#0E1016]/60 px-2 py-4 text-center transition duration-200 hover:border-[#FF7E00]/35 sm:min-h-[11.25rem] sm:gap-3 sm:px-3 sm:py-5"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#FF7E00]/25 bg-[#FF7E00]/10 text-[#FF7E00] transition duration-200 group-hover:scale-105 group-hover:border-[#FF7E00]/45 group-hover:bg-[#FF7E00]/16 sm:h-[4.5rem] sm:w-[4.5rem]">
                  <QuickLinkIcon id={id} className="h-8 w-8 sm:h-10 sm:w-10" />
                </div>
                <p className="flex min-h-[2.75rem] w-full flex-1 items-center justify-center text-pretty text-[9px] font-bold leading-snug tracking-tight text-white/75 transition group-hover:text-white sm:min-h-[3.25rem] sm:text-[10px]">
                  {opt.label}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-center">
        <Link
          href={`/client/settings${SETTINGS_QUICK_LINKS_HASH}`}
          className="text-xs font-semibold text-white/40 underline-offset-2 transition hover:text-white/65 hover:underline"
        >
          Edit quick links
        </Link>
      </p>
    </div>
  );
}
