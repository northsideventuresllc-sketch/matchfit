import { Suspense } from "react";
import EmailTemplateDenyClient from "./deny-client";

export default function EmailTemplateDenyPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#0B0C0F] px-5 py-16 text-white">Loading…</div>}>
      <EmailTemplateDenyClient />
    </Suspense>
  );
}
