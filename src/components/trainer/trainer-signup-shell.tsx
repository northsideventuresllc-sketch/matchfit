import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2";

export { inputClass };

export function TrainerSignupShell({
  stepLabel,
  title,
  description,
  backHref,
  backLabel,
  children,
}: {
  stepLabel: string;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
}) {
  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] px-5 py-10 text-white sm:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(255,126,0,0.14),transparent_55%)]"
      />
      <div className="relative mx-auto max-w-2xl">
        {backHref ? (
          <Link href={backHref} className="inline-flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-lg">
              <Image src="/logo.png" alt="Match Fit" fill className="object-contain" sizes="40px" />
            </div>
            <span className="text-sm font-bold text-white/70">{backLabel ?? "Back"}</span>
          </Link>
        ) : null}

        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7E00]">{stepLabel}</p>
        <h1 className="mt-2 text-2xl font-black uppercase tracking-tight sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 text-sm leading-relaxed text-white/55">{description}</p> : null}

        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}
