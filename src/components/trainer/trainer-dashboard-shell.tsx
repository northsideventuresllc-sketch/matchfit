"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrainerDashboardAppHeader } from "@/components/trainer/trainer-dashboard-app-header";
import { MATCH_FIT_PRODUCT_VERSION_LABEL } from "@/lib/match-fit-product-version";

export type TrainerDashboardShellProps = {
  displayName: string;
  profileImageUrl: string | null;
  initialUnreadCount: number;
  premiumStudioActive: boolean;
  /** When false, Chats nav is hidden (e.g. Independent Fitness Pro — nudges only). */
  showChatsInNav?: boolean;
  /** When false, the Compliance nav item is hidden (details page requires completed onboarding). */
  showComplianceInNav?: boolean;
  supportStrip?: React.ReactNode;
  children: React.ReactNode;
};

const NAV = [
  { href: "/trainer/dashboard", label: "Dashboard", match: (p: string) => p === "/trainer/dashboard" },
  {
    href: "/trainer/dashboard/discover-clients",
    label: "Discover Clients",
    match: (p: string) => p.startsWith("/trainer/dashboard/discover-clients"),
  },
  {
    href: "/trainer/dashboard/interests",
    label: "Inquiries",
    match: (p: string) => p.startsWith("/trainer/dashboard/interests"),
  },
  {
    href: "/trainer/dashboard/messages",
    label: "Chats",
    match: (p: string) => p.startsWith("/trainer/dashboard/messages"),
  },
  {
    href: "/trainer/dashboard/client-management",
    label: "Client Management",
    match: (p: string) => p.startsWith("/trainer/dashboard/client-management"),
  },
  {
    href: "/trainer/dashboard/bookings",
    label: "Schedule",
    match: (p: string) => p.startsWith("/trainer/dashboard/bookings"),
  },
  {
    href: "/trainer/dashboard/video-meetings",
    label: "Virtual Meetings",
    match: (p: string) => p.startsWith("/trainer/dashboard/video-meetings"),
  },
  {
    href: "/trainer/dashboard/account-tier",
    label: "Account Type",
    match: (p: string) => p.startsWith("/trainer/dashboard/account-tier"),
  },
  {
    href: "/trainer/dashboard/reviews",
    label: "Reviews",
    match: (p: string) => p.startsWith("/trainer/dashboard/reviews"),
  },
  {
    href: "/trainer/dashboard/match-questionnaire",
    label: "DAILY QUESTIONNAIRES",
    match: (p: string) => p.startsWith("/trainer/dashboard/match-questionnaire"),
  },
] as const;

// 5 primary tabs for the mobile bottom bar
const BOTTOM_NAV = [
  {
    href: "/trainer/dashboard",
    label: "Home",
    match: (p: string) => p === "/trainer/dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: "/trainer/dashboard/discover-clients",
    label: "Discover",
    match: (p: string) => p.startsWith("/trainer/dashboard/discover-clients"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    href: "/trainer/dashboard/messages",
    label: "Chats",
    match: (p: string) => p.startsWith("/trainer/dashboard/messages"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: "/trainer/dashboard/bookings",
    label: "Schedule",
    match: (p: string) => p.startsWith("/trainer/dashboard/bookings"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    href: "/trainer/dashboard/client-management",
    label: "Clients",
    match: (p: string) => p.startsWith("/trainer/dashboard/client-management") || p.startsWith("/trainer/dashboard/settings"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
] as const;

export function TrainerDashboardShell(props: TrainerDashboardShellProps) {
  const pathname = usePathname();
  const isHome = pathname === "/trainer/dashboard";
  const backHref = !isHome ? "/trainer/dashboard" : undefined;
  const backLabel = !isHome ? "← Dashboard" : undefined;
  const showChats = props.showChatsInNav !== false;
  const navItems = NAV.filter((item) => showChats || !item.href.includes("/messages"));
  const bottomNavItems = BOTTOM_NAV.filter((item) =>
    showChats ? true : !item.href.includes("/messages"),
  );

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#07080C] px-5 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-10 text-white md:px-8 md:pb-12 md:pt-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(255,126,0,0.14),transparent_55%)]"
      />
      <div className="relative mx-auto max-w-3xl">
        {props.supportStrip}

        <TrainerDashboardAppHeader
          displayName={props.displayName}
          profileImageUrl={props.profileImageUrl}
          backHref={backHref}
          backLabel={backLabel}
          initialUnreadCount={props.initialUnreadCount}
          premiumStudioActive={props.premiumStudioActive}
        />

        {/* Desktop horizontal nav — hidden on mobile */}
        <nav
          aria-label="Fitness Pro Dashboard"
          className="mb-8 hidden flex-wrap justify-center gap-2 rounded-2xl border border-white/[0.07] bg-[#0E1016]/60 p-1.5 backdrop-blur-md md:flex"
        >
          {navItems.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl px-3 py-2.5 text-xs font-black uppercase tracking-[0.1em] transition ${
                  active
                    ? "bg-[linear-gradient(135deg,rgba(255,211,78,0.2),rgba(255,126,0,0.18),rgba(227,43,43,0.12))] text-white shadow-[0_8px_24px_-12px_rgba(255,126,0,0.35)]"
                    : "text-white/45 hover:bg-white/[0.05] hover:text-white/80"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="w-full min-w-0 text-left">{props.children}</div>

        <footer className="mt-12 space-y-4 border-t border-white/[0.08] pt-6 text-center text-xs leading-relaxed text-white/45">
          <p className="mx-auto max-w-2xl">
            All billing information is safely encrypted and secured within the Match Fit interface and will not be
            shared with third parties unless express written consent is given.
          </p>
          <p className="mx-auto max-w-2xl">
            Keep sensitive coordination inside Match Fit chat once a thread is open. Automated systems may review chat
            content to help ensure contact details and off-platform payment instructions are not shared in chat.
            In-person exchanges of contact information are outside Match Fit&apos;s control and are not governed by these
            monitoring tools.
          </p>
          <p className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[10px] font-bold uppercase tracking-[0.14em]">
            <Link href="/privacy" className="text-white/50 underline-offset-2 transition hover:text-white/75 hover:underline">
              Privacy policy
            </Link>
            <Link href="/terms" className="text-white/50 underline-offset-2 transition hover:text-white/75 hover:underline">
              Terms of service
            </Link>
            <Link href="/share-idea" className="text-white/50 underline-offset-2 transition hover:text-white/75 hover:underline">
              Share An Idea
            </Link>
            <Link href="/report-bug" className="text-white/50 underline-offset-2 transition hover:text-white/75 hover:underline">
              Report a bug
            </Link>
          </p>
          <p className="text-center text-[9px] font-bold uppercase tracking-[0.18em] text-[#FF7E00]/50">
            Version {MATCH_FIT_PRODUCT_VERSION_LABEL}
          </p>
        </footer>
      </div>

      {/* Mobile bottom tab bar — visible only on mobile */}
      <nav
        aria-label="Fitness Pro navigation"
        className="fixed inset-x-0 bottom-0 z-50 flex items-stretch border-t border-white/[0.08] bg-[#07080C]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        {bottomNavItems.map((item) => {
          const active = item.match(pathname);
          const hasUnread = item.href.includes("/messages") && props.initialUnreadCount > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] transition-colors ${
                active ? "text-[#FF7E00]" : "text-white/40"
              }`}
            >
              <span className="relative">
                {item.icon}
                {hasUnread && (
                  <span className="absolute -right-1 -top-1 flex h-2 w-2 items-center justify-center rounded-full bg-[#E32B2B]" />
                )}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </main>
  );
}
