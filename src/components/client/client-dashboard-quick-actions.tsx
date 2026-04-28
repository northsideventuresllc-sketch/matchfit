"use client";

import Link from "next/link";

function IconMatchArms(props: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={props.className} aria-hidden>
      <circle cx="22" cy="24" r="10" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="42" cy="24" r="10" stroke="currentColor" strokeWidth="2.5" />
      <path
        d="M18 38c4 6 10 8 14 8s10-2 14-8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M26 32h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M30 28v8M34 28v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconMessages(props: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={props.className} aria-hidden>
      <path
        d="M12 20h40a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H28l-10 8v-8h-6a4 4 0 0 1-4-4V24a4 4 0 0 1 4-4Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M20 30h24M20 36h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function IconProfile(props: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={props.className} aria-hidden>
      <circle cx="32" cy="22" r="10" stroke="currentColor" strokeWidth="2.5" />
      <path
        d="M16 52c2-10 10-16 16-16s14 6 16 16"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const ACTIONS = [
  {
    href: "/client/dashboard/find-trainers",
    label: "FIND COACHES",
    Icon: IconMatchArms,
  },
  {
    href: "/client/dashboard/messages",
    label: "ALL CHATS",
    Icon: IconMessages,
  },
  {
    href: "/client/dashboard/profile",
    label: "PREVIEW YOUR PROFILE",
    Icon: IconProfile,
  },
] as const;

export function ClientDashboardQuickActions() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[#12151C] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[#12151C] to-transparent" />
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ACTIONS.map((a) => {
          const Icon = a.Icon;
          return (
          <Link
            key={a.href}
            href={a.href}
            className="group flex min-w-[46%] shrink-0 snap-center flex-col items-center justify-start gap-3 rounded-2xl border border-white/[0.08] bg-[#0E1016]/60 px-4 py-6 text-center transition duration-200 hover:border-[#FF7E00]/35 sm:min-w-[30%]"
          >
            <div className="flex h-20 w-20 scale-100 items-center justify-center rounded-2xl border border-[#FF7E00]/25 bg-[#FF7E00]/10 text-[#FF7E00] transition duration-200 group-hover:scale-110 group-hover:border-[#FF7E00]/45 group-hover:bg-[#FF7E00]/16">
              <Icon className="h-11 w-11" />
            </div>
            <p className="text-[10px] font-black uppercase leading-tight tracking-[0.14em] text-white/70 transition group-hover:text-white">
              {a.label}
            </p>
          </Link>
          );
        })}
      </div>
    </div>
  );
}
