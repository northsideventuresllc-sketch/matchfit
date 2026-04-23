"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AccountLogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/client/logout", { method: "POST" });
      router.push("/client");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={logout}
      className="w-full min-h-[3rem] rounded-xl border border-white/10 px-4 text-sm font-black uppercase tracking-[0.08em] text-white/70 transition hover:border-white/20 hover:text-white disabled:opacity-50"
    >
      {busy ? "Signing out…" : "Log out"}
    </button>
  );
}
