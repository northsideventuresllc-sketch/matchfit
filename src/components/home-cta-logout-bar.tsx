"use client";

import { useState } from "react";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";
import { postClientLogout } from "@/lib/client-logout";
import { postTrainerLogout } from "@/lib/trainer-logout";

export function HomeCtaLogoutBar() {
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await Promise.all([postClientLogout(), postTrainerLogout()]);
    } finally {
      navigateWithFullLoad("/");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl justify-center px-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => void logout()}
        className="min-h-[3.75rem] w-full max-w-md rounded-2xl border border-white/[0.12] bg-white/[0.06] px-8 text-center text-base font-black uppercase tracking-[0.12em] text-white/90 shadow-[0_20px_50px_-28px_rgba(227,43,43,0.35)] transition hover:border-[#E32B2B]/40 hover:bg-white/[0.09] hover:text-white disabled:opacity-60 sm:min-h-[4rem]"
      >
        {busy ? "Signing out…" : "LOG OUT"}
      </button>
    </div>
  );
}
