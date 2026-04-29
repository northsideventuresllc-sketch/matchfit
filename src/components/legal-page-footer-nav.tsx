"use client";

import Link from "next/link";

export type LegalPageFooterRole = "client" | "trainer" | "guest";

/** Row of footer actions, centered; uppercase is on each control because native buttons often skip inherited text-transform. */
const navClass =
  "mt-10 flex flex-row flex-wrap items-center justify-center gap-x-6 gap-y-2 text-center";
const linkClass = "text-xs font-semibold uppercase tracking-wide text-[#FF7E00] hover:underline";
const buttonClass =
  "cursor-pointer border-0 bg-transparent p-0 text-center text-xs font-semibold uppercase tracking-wide text-[#FF7E00] hover:underline";

export function LegalPageFooterNav(props: { role: LegalPageFooterRole }) {
  function goBack() {
    if (typeof window === "undefined") return;
    window.history.back();
  }

  if (props.role === "client") {
    return (
      <nav className={navClass} aria-label="Leave this page">
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
      <nav className={navClass} aria-label="Leave this page">
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
    <nav className={navClass} aria-label="Leave this page">
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
