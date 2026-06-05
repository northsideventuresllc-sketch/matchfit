import { Suspense } from "react";
import TrainerSignupPaymentReturnClient from "./trainer-signup-payment-return-client";

export const dynamic = "force-dynamic";

export default function TrainerSignupPaymentReturnPage() {
  return (
    <Suspense fallback={<p className="min-h-dvh bg-[#0B0C0F] px-5 py-10 text-sm text-white/50">Loading…</p>}>
      <TrainerSignupPaymentReturnClient />
    </Suspense>
  );
}
