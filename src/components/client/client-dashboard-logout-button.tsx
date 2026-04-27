"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postClientLogout } from "@/lib/client-logout";

export function ClientDashboardLogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex justify-center pt-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await postClientLogout();
            router.push("/client");
            router.refresh();
          } finally {
            setBusy(false);
          }
        }}
        className="text-sm font-black uppercase tracking-[0.12em] text-[#FF7E00] underline-offset-4 transition hover:underline disabled:opacity-50"
      >
        {busy ? "SIGNING OUT…" : "LOG OUT"}
      </button>
    </div>
  );
}
