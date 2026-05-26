"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClientDashboardAppHeader } from "@/components/client/client-dashboard-app-header";
import { ClientDiyGovernanceGateBanner } from "@/components/client/client-diy-governance-gate";
import type { ClientDiyGovernanceGate } from "@/lib/diy-governance";

export type ClientDashboardShellProps = {
  preferredName: string;
  profileImageUrl: string | null;
  initialUnreadCount: number;
  /** Blocking DIY prompts (extension approval or post-deadline attestation). */
  diyGovernanceGate?: ClientDiyGovernanceGate | null;
  /** Staff impersonation notice (rendered above navigation). */
  supportStrip?: React.ReactNode;
  children: React.ReactNode;
};

const NAV = [
  { href: "/client/dashboard", label: "Dashboard", match: (p: string) => p === "/client/dashboard" },
  {
    href: "/client/dashboard/fithub",
    label: "FitHub",
    match: (p: string) => p.startsWith("/client/dashboard/fithub"),
  },
  {
    href: "/client/dashboard/daily-questionnaire",
    label: "Daily questionnaire",
    match: (p: string) => p.startsWith("/client/dashboard/daily-questionnaire"),
  },
  {
    href: "/client/dashboard/find-trainers",
    label: "Find coaches",
    match: (p: string) => p.startsWith("/client/dashboard/find-trainers"),
  },
  {
    href: "/client/dashboard/messages",
    label: "Chats",
    match: (p: string) => p.startsWith("/client/dashboard/messages"),
  },
  {
    href: "/client/dashboard/service-management",
    label: "Service Management",
    match: (p: string) => p.startsWith("/client/dashboard/service-management"),
  },
  {
    href: "/client/dashboard/preferences",
    label: "Match Preferences",
    match: (p: string) => p === "/client/dashboard/preferences",
  },
] as const;

// 5 primary tabs shown in the mobile bottom bar
const BOTTOM_NAV = [
  {
    href: "/client/dashboard",
    label: "Home",
    match: (p: string) => p === "/client/dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: "/client/dashboard/find-trainers",
    label: "Find",
    match: (p: string) => p.startsWith("/client/dashboard/find-trainers"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    href: "/client/dashboard/messages",
    label: "Chats",
    match: (p: string) => p.startsWith("/client/dashboard/messages"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: "/client/dashboard/fithub",
    label: "FitHub",
    match: (p: string) => p.startsWith("/client/dashboard/fithub"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M18 20V10M12 20V4M6 20v-6" />
      </svg>
    ),
  },
  {
    href: "/client/dashboard/preferences",
    label: "Profile",
    match: (p: string) => p.startsWith("/client/dashboard/preferences") || p.startsWith("/client/dashboard/profile"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
] as const;

export function ClientDashboardShell(props: ClientDashboardShellProps) {
  const pathname = usePathname();
  const isHome = pathname === "/client/dashboard";
  const backHref = !isHome ? "/client/dashboard" : undefined;
  const backLabel = !isHome ? "← Dashboard" : undefined;

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#07080C] px-5 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-10 text-white sm:px-8 sm:pb-12 sm:pt-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(255,126,0,0.14),transparent_55%)]"
      />
      <div className="relative mx-auto max-w-3xl">
        {props.supportStrip}

        <ClientDashboardAppHeader
          preferredName={props.preferredName}
          profileImageUrl={props.profileImageUrl}
          backHref={backHref}
          backLabel={backLabel}
          initialUnreadCount={props.initialUnreadCount}
        />

        {/* Desktop horizontal nav — hidden on mobile */}
        <nav
          aria-label="Client Dashboard"
          className="mb-8 hidden flex-wrap justify-center gap-2 rounded-2xl border border-white/[0.07] bg-[#0E1016]/60 p-1.5 backdrop-blur-md sm:flex"
        >
          {NAV.map((item) => {
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

        {props.diyGovernanceGate ? <ClientDiyGovernanceGateBanner gate={props.diyGovernanceGate} /> : null}

        <div className="w-full text-left">{props.children}</div>

        <footer className="mt-12 space-y-4 border-t border-white/[0.08] pt-6 text-xs leading-relaxed text-white/45">
          <p className="text-center">
            All billing information is safely encrypted and secured within the Match Fit interface and will not be
            shared with third parties unless express written consent is given.
          </p>
          <p className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[10px] font-bold uppercase tracking-[0.14em]">
            <Link href="/privacy" className="text-white/50 underline-offset-2 transition hover:text-white/75 hover:underline">
              Privacy policy
            </Link>
            <Link href="/terms" className="text-white/50 underline-offset-2 transition hover:text-white/75 hover:underline">
              Terms of service
            </Link>
            <Link
              href="/client/dashboard/share-idea"
              className="text-white/50 underline-offset-2 transition hover:text-white/75 hover:underline"
            >
              Share An Idea
            </Link>
            <Link
              href="/client/dashboard/bug-report"
              className="text-white/50 underline-offset-2 transition hover:text-white/75 hover:underline"
            >
              Report a bug
            </Link>
          </p>
        </footer>
      </div>

      {/* Mobile bottom tab bar — visible only on mobile */}
      <nav
        aria-label="Client Navigation"
        className="fixed inset-x-0 bottom-0 z-50 flex items-stretch border-t border-white/[0.08] bg-[#07080C]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden"
      >
        {BOTTOM_NAV.map((item) => {
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
