import Link from "next/link";

export default function DownloadSendWelcomeAnalysisPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Download analysis bundle</h1>
      <p className="text-neutral-600">
        Saves <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-sm">MATCH-FIT-SEND-WELCOME-CODE-FOR-ANALYSIS.md</code>{" "}
        to your computer (same content as <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-sm">docs/</code> in the repo).
      </p>
      <p>
        <a
          href="/api/download-send-welcome-analysis"
          className="inline-flex rounded-lg bg-neutral-900 px-5 py-3 text-sm font-semibold text-white no-underline hover:bg-neutral-800"
        >
          Download .md file
        </a>
      </p>
      <p className="text-sm text-neutral-500">
        <Link href="/" className="text-neutral-700 underline underline-offset-2 hover:text-neutral-900">
          Back to home
        </Link>
      </p>
    </main>
  );
}
