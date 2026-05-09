import type { ReactNode } from "react";

type Props = {
  title: string;
  /** Title color accent (e.g. orange for highlighted sections). */
  titleClassName?: string;
  subtitle?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function ClientDashboardHomeSection(props: Props) {
  return (
    <details
      open={props.defaultOpen ?? true}
      className="group rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 backdrop-blur-xl sm:p-8"
    >
      <summary className="flex cursor-pointer list-none flex-col items-center gap-2 rounded-xl px-1 py-1 text-center marker:content-none [&::-webkit-details-marker]:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7E00]/70">
        <span className="flex items-center justify-center gap-2">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/55 transition-transform duration-200 group-open:rotate-180"
            aria-hidden
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-current">
              <path
                d="M4 6l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <h2
            className={`text-xs font-bold uppercase tracking-[0.18em] ${props.titleClassName ?? "text-white/40"}`}
          >
            {props.title}
          </h2>
        </span>
        {props.subtitle ? <div className="max-w-lg text-sm leading-relaxed text-white/50">{props.subtitle}</div> : null}
      </summary>
      <div className="mt-6">{props.children}</div>
    </details>
  );
}
