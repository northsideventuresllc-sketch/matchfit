"use client";

import { useState } from "react";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";
import { postTrainerLogout } from "@/lib/trainer-logout";

export function TrainerDashboardLogoutLink() {
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
            navigateWithFullLoad("/trainer/dashboard/login");
          } finally {
            setBusy(false);
          }
        }}
        className="text-[#FF7E00] underline-offset-2 transition hover:underline disabled:opacity-50"
      >
        {busy ? "Signing out…" : "Log Out"}
      </button>
    </div>
  );
}
