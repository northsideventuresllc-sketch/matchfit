import Link from "next/link";

export const metadata = {
  title: "Email verified · Match Fit",
};

/** Shown after Supabase email confirmation when `pending_match_fit_profile` is set for a client sign-up flow. */
export default function ClientSignUpCompletePage() {
  return (
    <main className="min-h-dvh bg-[#0B0C0F] px-5 py-16 text-white">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-black tracking-tight">Email verified</h1>
        <p className="mt-4 text-sm leading-relaxed text-white/60">
          Continue with Match Fit client sign-up to choose a plan and finish creating your account.
        </p>
        <Link
          href="/client/subscribe"
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-6 text-sm font-black text-[#0B0C0F]"
        >
          Continue to subscription
        </Link>
        <p className="mt-8 text-xs text-white/40">
          <Link href="/client/sign-up" className="underline-offset-2 hover:underline">
            Back to sign-up
          </Link>
        </p>
      </div>
    </main>
  );
}
