"use client";

import Link from "next/link";

export type LegalPageFooterRole = "client" | "trainer" | "guest";

const linkClass = "text-sm font-semibold text-[#FF7E00] hover:underline";
const buttonClass =
  "cursor-pointer border-0 bg-transparent p-0 text-left text-sm font-semibold text-[#FF7E00] hover:underline";

export function LegalPageFooterNav(props: { role: LegalPageFooterRole }) {
  function goBack() {
    if (typeof window === "undefined") return;
    window.history.back();
  }

  if (props.role === "client") {
    return (
      <nav className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8 sm:gap-y-2" aria-label="Leave this page">
        <button type="button" className={buttonClass} onClick={goBack}>
          Previous page
        </button>
        <Link href="/client/dashboard" className={linkClass}>
          Client dashboard
        </Link>
      </nav>
    );
  }

  if (props.role === "trainer") {
    return (
      <nav className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8 sm:gap-y-2" aria-label="Leave this page">
        <button type="button" className={buttonClass} onClick={goBack}>
          Previous page
        </button>
        <Link href="/trainer/dashboard" className={linkClass}>
          Trainer dashboard
        </Link>
      </nav>
    );
  }

  return (
    <nav className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8 sm:gap-y-2" aria-label="Leave this page">
      <Link href="/" className={linkClass}>
        Back to Home
      </Link>
      <Link href="/client/sign-up" className={linkClass}>
        Client sign up
      </Link>
      <Link href="/trainer/signup" className={linkClass}>
        Trainer sign up
      </Link>
    </nav>
  );
}
