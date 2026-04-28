"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postTrainerLogout } from "@/lib/trainer-logout";

export function TrainerDashboardLogoutLink() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <div className="text-center text-sm">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await postTrainerLogout();
            router.push("/trainer/dashboard/login");
            router.refresh();
          } finally {
            setBusy(false);
          }
        }}
        className="text-[#FF7E00] underline-offset-2 transition hover:underline disabled:opacity-50"
      >
        {busy ? "Signing out…" : "Log out"}
      </button>
    </div>
  );
}
