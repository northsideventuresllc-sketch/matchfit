import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-[#0B0C0F] px-5 py-12 text-white sm:px-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Privacy Policy</h1>
        <p className="mt-6 text-sm leading-relaxed text-white/60">
          This is a placeholder page. Replace this content with your legal Privacy Policy before linking it from live
          dashboards.
        </p>
        <p className="mt-10">
          <Link href="/" className="text-sm font-semibold text-[#FF7E00] hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
