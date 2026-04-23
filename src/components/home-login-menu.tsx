"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function HomeLoginMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        id="home-login-menu-button"
        aria-controls="home-login-menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7E00]/50"
      >
        Log in
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
          <Link href="/client" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            Client Dashboard
          </Link>
          <Link href="/trainer/dashboard/login" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            Trainer Dashboard
          </Link>
          <div className="my-2 h-px bg-white/[0.08]" role="separator" />
          <Link href="/client/sign-up" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            Client Sign Up
          </Link>
          <Link href="/trainer/signup" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            Trainer Sign Up
          </Link>
        </div>
      ) : null}
    </div>
  );
}
