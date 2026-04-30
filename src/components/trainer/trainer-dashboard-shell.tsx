"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrainerDashboardAppHeader } from "@/components/trainer/trainer-dashboard-app-header";

export type TrainerDashboardShellProps = {
  displayName: string;
  profileImageUrl: string | null;
  initialUnreadCount: number;
  premiumStudioActive: boolean;
  /** When false, the Compliance nav item is hidden (details page requires completed onboarding). */
  showComplianceInNav?: boolean;
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
    href: "/trainer/dashboard/match-questionnaire",
    label: "DAILY QUESTIONNAIRES",
    match: (p: string) => p.startsWith("/trainer/dashboard/match-questionnaire"),
  },
] as const;

export function TrainerDashboardShell(props: TrainerDashboardShellProps) {
  const pathname = usePathname();
  const isHome = pathname === "/trainer/dashboard";
  const backHref = !isHome ? "/trainer/dashboard" : undefined;
  const backLabel = !isHome ? "← Dashboard" : undefined;
  const navItems = NAV;

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#07080C] px-5 py-10 text-white sm:px-8 sm:py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(255,126,0,0.14),transparent_55%)]"
      />
      <div className="relative mx-auto max-w-3xl">
        <TrainerDashboardAppHeader
          displayName={props.displayName}
          profileImageUrl={props.profileImageUrl}
          backHref={backHref}
          backLabel={backLabel}
          initialUnreadCount={props.initialUnreadCount}
          premiumStudioActive={props.premiumStudioActive}
        />

        <nav
          aria-label="Trainer Dashboard"
          className="mb-8 flex flex-wrap justify-center gap-2 rounded-2xl border border-white/[0.07] bg-[#0E1016]/60 p-1.5 backdrop-blur-md"
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

        {props.children}

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
            <Link href="/report-bug" className="text-white/50 underline-offset-2 transition hover:text-white/75 hover:underline">
              Report a bug
            </Link>
            <Link href="/privacy" className="text-white/50 underline-offset-2 transition hover:text-white/75 hover:underline">
              Privacy policy
            </Link>
            <Link href="/terms" className="text-white/50 underline-offset-2 transition hover:text-white/75 hover:underline">
              Terms of service
            </Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
