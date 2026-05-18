"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-dvh bg-[#0B0C0F] px-6 py-16 text-white">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-3 max-w-md text-sm text-white/65">Please try again. If the problem continues, contact support.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#0B0C0F]"
        >
          Try again
        </button>
        <Link href="/" className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/85">
          Home
        </Link>
      </div>
    </div>
  );
}
