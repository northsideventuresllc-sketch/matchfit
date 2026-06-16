import type { ReactNode } from "react";

const chevronClass =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.1] text-xs font-bold text-white/45 transition-transform duration-200 group-open:rotate-90";

const summaryRowClass =
  "flex w-full cursor-pointer list-none items-start gap-3 text-left [-webkit-details-marker]:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7E00]/70";

export function HomeAudienceGroupHeader({
  id,
  eyebrow,
  eyebrowClass,
  title,
  description,
}: {
  id?: string;
  eyebrow: string;
  eyebrowClass: string;
  title: string;
  description?: string;
}) {
  return (
    <div id={id} className="scroll-mt-28 pt-4 first:pt-0">
      <p className={`text-xs font-bold uppercase tracking-[0.28em] ${eyebrowClass}`}>{eyebrow}</p>
      <h2 className="mt-2 text-balance text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 max-w-3xl text-pretty text-sm leading-relaxed text-white/55 sm:text-base">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function HomeCollapsibleSection({
  id,
  eyebrow,
  eyebrowClass,
  title,
  children,
  accent = "left",
  defaultOpen = false,
  variant = "card",
}: {
  id?: string;
  eyebrow: string;
  eyebrowClass: string;
  title: string;
  children: ReactNode;
  accent?: "left" | "right";
  defaultOpen?: boolean;
  variant?: "card" | "plain";
}) {
  const shellClass =
    variant === "card"
      ? "relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#12151C]/75 shadow-[0_34px_90px_-50px_rgba(227,43,43,0.45)] backdrop-blur-xl"
      : "relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#12151C]/75 backdrop-blur-xl";

  return (
    <details id={id} open={defaultOpen} className={`group scroll-mt-28 ${shellClass}`}>
      <summary className={`${summaryRowClass} p-7 sm:p-9`}>
        <span className={chevronClass} aria-hidden>
          ▸
        </span>
        <div className="relative min-w-0 flex-1">
          <div
            aria-hidden
            className={`pointer-events-none absolute ${accent === "left" ? "-left-24 -top-28" : "-right-20 -bottom-32"} h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,126,0,0.22),transparent_68%)]`}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-8 -left-12 h-48 w-48 rounded-full bg-[radial-gradient(circle_at_center,rgba(227,43,43,0.18),transparent_72%)]"
          />
          <div className="relative">
            <p className={`text-xs font-bold uppercase tracking-[0.22em] ${eyebrowClass}`}>{eyebrow}</p>
            <h3 className="mt-3 text-balance text-xl font-black uppercase leading-tight tracking-wide text-white sm:text-2xl md:text-[1.65rem]">
              {title}
            </h3>
          </div>
        </div>
      </summary>
      <div className="border-t border-white/[0.08] px-7 pb-7 pt-2 sm:px-9 sm:pb-9">
        <div className="space-y-4 text-pretty text-[15px] leading-relaxed text-white/65 sm:text-base">
          {children}
        </div>
      </div>
    </details>
  );
}
