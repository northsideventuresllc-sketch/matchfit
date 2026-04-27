"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { postClientLogout } from "@/lib/client-logout";
import { postTrainerLogout } from "@/lib/trainer-logout";
import type { HomePageAuth } from "@/lib/home-page-auth";
import {
  CLIENT_DASHBOARD_PATH,
  CLIENT_SIGN_IN_PATH,
  CLIENT_SIGN_UP_PATH,
  TRAINER_DASHBOARD_PATH,
  TRAINER_SIGN_IN_PATH,
  TRAINER_SIGN_UP_PATH,
} from "@/lib/home-page-auth";

type Props = { homeAuth: HomePageAuth };

export function HomeLoginMenu({ homeAuth }: Props) {
  const [open, setOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const loggedIn = homeAuth.clientLoggedIn || homeAuth.trainerLoggedIn;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const itemClass =
    "block w-full px-4 py-2.5 text-left text-sm text-white/85 transition hover:bg-white/[0.06] hover:text-white focus:bg-white/[0.06] focus:text-white focus:outline-none";

  async function logout() {
    setLogoutBusy(true);
    try {
      await Promise.all([postClientLogout(), postTrainerLogout()]);
    } finally {
      window.location.href = "/";
    }
  }

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        id="home-login-menu-button"
        aria-controls="home-login-menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold tracking-wide text-white/80 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7E00]/50 normal-case"
      >
        Account
        <span aria-hidden className="text-[10px] text-white/50">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open ? (
        <div
          id="home-login-menu"
          role="menu"
          aria-labelledby="home-login-menu-button"
          className="absolute right-0 z-50 mt-2 min-w-[14.5rem] overflow-hidden rounded-2xl border border-white/[0.1] bg-[#12151C]/95 py-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)] backdrop-blur-xl"
        >
          {loggedIn ? (
            <>
              {homeAuth.clientLoggedIn ? (
                <Link
                  href={CLIENT_DASHBOARD_PATH}
                  role="menuitem"
                  className={itemClass}
                  onClick={() => setOpen(false)}
                >
                  Client Dashboard
                </Link>
              ) : null}
              {homeAuth.trainerLoggedIn ? (
                <Link
                  href={TRAINER_DASHBOARD_PATH}
                  role="menuitem"
                  className={itemClass}
                  onClick={() => setOpen(false)}
                >
                  Trainer Dashboard
                </Link>
              ) : null}
              <div className="mx-3 my-2 border-t border-dashed border-white/[0.2]" role="separator" />
              <button
                type="button"
                role="menuitem"
                className={`${itemClass} font-semibold text-[#E32B2B]/95 hover:text-[#ff5a5a]`}
                disabled={logoutBusy}
                onClick={() => void logout()}
              >
                {logoutBusy ? "Signing out…" : "Log Out"}
              </button>
            </>
          ) : (
            <>
              <Link href={CLIENT_SIGN_IN_PATH} role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
                Client Sign In
              </Link>
              <Link
                href={TRAINER_SIGN_IN_PATH}
                role="menuitem"
                className={itemClass}
                onClick={() => setOpen(false)}
              >
                Trainer Sign In
              </Link>
              <div className="mx-3 my-2 border-t border-dashed border-white/[0.2]" role="separator" />
              <Link href={CLIENT_SIGN_UP_PATH} role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
                Client Sign Up
              </Link>
              <Link href={TRAINER_SIGN_UP_PATH} role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
                Trainer Sign Up
              </Link>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
