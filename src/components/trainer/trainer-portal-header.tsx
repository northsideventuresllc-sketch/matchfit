"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { postTrainerLogout } from "@/lib/trainer-logout";

type Props = {
  displayName: string;
  profileImageUrl?: string | null;
  /** When set, shows this link on the left (e.g. back to dashboard from settings). */
  backHref?: string;
  backLabel?: string;
  /** Trainer dashboard: primary entry to required Match Me + future optional questionnaires. */
  matchQuestionnairesCta?: {
    href: string;
    headline: string;
    description: string;
  };
};

export function TrainerPortalHeader(props: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const initial = props.displayName.trim().charAt(0).toUpperCase() || "?";
  const avatar = props.profileImageUrl?.split("?")[0];

  async function logout() {
    setLogoutBusy(true);
    try {
      await postTrainerLogout();
      router.push("/trainer/dashboard/login");
      router.refresh();
    } finally {
      setLogoutBusy(false);
      setMenuOpen(false);
    }
  }

  const cta = props.matchQuestionnairesCta;

  return (
    <header className="mb-8 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 pt-0.5">
          {props.backHref ? (
            <Link
              href={props.backHref}
              className="text-xs font-semibold uppercase tracking-wide text-white/45 transition hover:text-white/70"
            >
              {props.backLabel ?? "Back"}
            </Link>
          ) : (
            <Link href="/" className="text-xs font-semibold uppercase tracking-wide text-white/45 transition hover:text-white/70">
              Home
            </Link>
          )}
        </div>

        <div className="relative flex shrink-0 items-center gap-3" ref={wrapRef}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-[#0E1016] text-sm font-black text-white/90 outline-none ring-[#FF7E00]/40 transition hover:border-white/25 focus-visible:ring-2"
            aria-label="Account menu"
          >
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element -- local upload path
              <img src={avatar} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <span aria-hidden>{initial}</span>
            )}
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-[12rem] overflow-hidden rounded-xl border border-white/10 bg-[#12151C] py-1 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.85)]"
            >
              <Link
                role="menuitem"
                href="/trainer/dashboard/settings"
                className="block px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/[0.06]"
                onClick={() => setMenuOpen(false)}
              >
                Account Settings
              </Link>
              <button
                role="menuitem"
                type="button"
                disabled={logoutBusy}
                onClick={() => void logout()}
                className="w-full px-4 py-3 text-left text-sm font-semibold text-white/70 transition hover:bg-white/[0.06] disabled:opacity-50"
              >
                {logoutBusy ? "Signing out…" : "Log out"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {cta ? (
        <Link
          href={cta.href}
          title={cta.description}
          className="block w-full rounded-2xl border border-[#FF7E00]/30 bg-[linear-gradient(145deg,rgba(255,126,0,0.12),rgba(227,43,43,0.06))] px-4 py-3 text-left shadow-[0_12px_40px_-20px_rgba(255,126,0,0.35)] transition hover:border-[#FF7E00]/45 hover:bg-[linear-gradient(145deg,rgba(255,126,0,0.16),rgba(227,43,43,0.08))] sm:py-2.5"
        >
          <span className="block text-[11px] font-black uppercase tracking-[0.12em] text-[#FF7E00]">{cta.headline}</span>
          <span className="mt-1.5 block text-[11px] leading-snug text-white/60 sm:text-xs sm:leading-relaxed">{cta.description}</span>
          <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-white/50">
            Open questionnaires <span aria-hidden className="text-[#FF7E00]">→</span>
          </span>
        </Link>
      ) : null}
    </header>
  );
}
