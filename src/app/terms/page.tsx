import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-dvh bg-[#0B0C0F] px-5 py-12 text-white sm:px-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Terms of Service</h1>
        <p className="mt-6 text-sm leading-relaxed text-white/60">
          This is a placeholder page. Replace this content with your legal Terms of Service
          before inviting users to accept them at sign-up.
        </p>
        <p className="mt-10">
          <Link href="/client/sign-up" className="text-sm font-semibold text-[#FF7E00] hover:underline">
            Back to sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
