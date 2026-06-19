import Link from "next/link";

export const metadata = {
  title: "Sign-in link issue · Match Fit",
};

export default function AuthCodeErrorPage() {
  return (
    <main className="min-h-dvh bg-[#0B0C0F] px-5 py-16 text-white">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-black tracking-tight">We could not confirm that link</h1>
        <p className="mt-4 text-sm leading-relaxed text-white/60">
          The link may have expired or was already used. Request a new verification email from the sign-up screen, or try
          signing in again.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/client/sign-up"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white/10 px-5 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            Client sign-up
          </Link>
          <Link
            href="/trainer/signup"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-5 text-sm font-black text-[#0B0C0F]"
          >
            Trainer sign-up
          </Link>
        </div>
        <p className="mt-10 text-xs text-white/35">
          <Link href="/client" className="underline-offset-2 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
