"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";
import { postTrainerLogout } from "@/lib/trainer-logout";

type Props = {
  displayName: string;
  profileImageUrl?: string | null;
  /** When set, shows this link on the left (e.g. back to dashboard from settings). */
  backHref?: string;
  backLabel?: string;
};

export function TrainerPortalHeader(props: Props) {
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
      navigateWithFullLoad("/trainer/dashboard/login");
    } finally {
      setLogoutBusy(false);
      setMenuOpen(false);
    }
  }

  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
        <div className="flex shrink-0 items-center pt-0.5">
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
    </header>
  );
}
