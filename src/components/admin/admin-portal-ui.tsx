import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { MATCH_FIT_PRODUCT_VERSION_LABEL } from "@/lib/match-fit-product-version";

/** Shared Tailwind tokens for administrator pages (aligned with match-fit.net marketing + portals). */
export const adminInputClass =
  "w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2";

export const adminInputClassSm =
  "w-full rounded-xl border border-white/10 bg-[#0E1016] px-3 py-2.5 text-sm text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2";

export const adminLabelClass = "text-xs font-semibold uppercase tracking-wide text-white/50";

export const adminLinkClass =
  "font-semibold text-[#FF7E00] underline-offset-4 transition hover:text-[#FFD34E] hover:underline";

export const adminEyebrowClass = "text-xs font-bold uppercase tracking-[0.22em] text-[#FF7E00]";

export const adminSectionTitleClass = "text-[11px] font-black uppercase tracking-[0.18em] text-white/40";

export const adminPanelClass =
  "rounded-2xl border border-white/[0.08] bg-[#12151C] shadow-[0_34px_90px_-48px_rgba(227,43,43,0.35)] max-md:[backdrop-filter:none] md:bg-[#12151C]/90 md:backdrop-blur-xl";

export const adminPanelInnerClass =
  "rounded-xl border border-white/[0.06] bg-[#0E1016]/80";

export const adminCardClass = `${adminPanelClass} p-5 sm:p-6`;

export const adminPrimaryButtonClass =
  "mf-gradient-cta inline-flex min-h-[2.75rem] shrink-0 items-center justify-center rounded-xl border border-[#FF7E00]/40 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-5 py-2.5 text-xs font-black uppercase tracking-[0.1em] text-[#0B0C0F] touch-manipulation transition max-md:shadow-none md:shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] md:hover:opacity-95 md:active:opacity-90 disabled:opacity-45 disabled:grayscale-[0.3]";

export const adminSecondaryButtonClass =
  "rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-xs font-black uppercase tracking-[0.1em] text-white/80 transition hover:border-white/25 hover:bg-white/[0.07] disabled:opacity-40";

export const adminAccentButtonClass =
  "shrink-0 rounded-lg border border-[#FF7E00]/35 bg-[#FF7E00]/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#FFD34E] transition hover:border-[#FF7E00]/50 hover:bg-[#FF7E00]/15 disabled:opacity-40";

export function AdminPortalBackdrop() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(255,211,78,0.14),transparent_55%),radial-gradient(ellipse_90%_60%_at_100%_0%,rgba(255,126,0,0.1),transparent_50%),radial-gradient(ellipse_70%_50%_at_0%_100%,rgba(227,43,43,0.06),transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(180deg,rgba(45,52,64,0.28)_0%,transparent_38%,transparent_72%,rgba(11,12,15,0.92)_100%)]"
      />
    </>
  );
}

export function AdminPortalLogoLink({ subtitle = "Administrator" }: { subtitle?: string }) {
  return (
    <Link href="/" className="flex items-center gap-3 opacity-90 transition hover:opacity-100">
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl sm:h-11 sm:w-11">
        <Image src="/logo.png" alt="Match Fit" fill className="object-contain" sizes="44px" priority />
      </div>
      <div className="leading-none">
        <p className="text-sm font-black tracking-tight">
          <span className="text-[#E8EAEF]">Match</span> <span className="text-[#E32B2B]">Fit</span>
        </p>
        <p className="mt-0.5 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[#FF7E00]/80">{subtitle}</p>
      </div>
    </Link>
  );
}

export function AdminPortalShell({
  children,
  maxWidth = "max-w-6xl",
  className = "",
}: {
  children: ReactNode;
  maxWidth?: string;
  className?: string;
}) {
  return (
    <main
      className={`relative min-h-svh overflow-x-hidden overscroll-y-none bg-[#0B0C0F] px-5 py-10 text-white antialiased sm:px-8 sm:py-12 ${className}`}
    >
      <AdminPortalBackdrop />
      <div className={`relative z-10 mx-auto ${maxWidth}`}>{children}</div>
    </main>
  );
}

export function AdminPortalPageHeader(props: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  showVersion?: boolean;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <AdminPortalLogoLink />
        <h1 className="mt-6 text-2xl font-black tracking-tight sm:text-3xl">{props.title}</h1>
        {props.showVersion !== false ? (
          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-[#FF7E00]/60">
            Version {MATCH_FIT_PRODUCT_VERSION_LABEL}
          </p>
        ) : null}
        {props.description ? (
          <div className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">{props.description}</div>
        ) : null}
      </div>
      {props.actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{props.actions}</div> : null}
    </header>
  );
}

export function AdminPortalAlert({
  children,
  variant = "error",
}: {
  children: ReactNode;
  variant?: "error" | "success" | "info";
}) {
  const styles =
    variant === "error"
      ? "border-[#E32B2B]/35 bg-[#E32B2B]/10 text-[#FFB4B4]"
      : variant === "success"
        ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-100"
        : "border-[#FF7E00]/25 bg-[#FF7E00]/[0.06] text-white/75";
  return (
    <p className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${styles}`} role={variant === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
}

export function AdminPortalBetaNotice({ className = "mt-4" }: { className?: string }) {
  return (
    <p
      className={`mx-auto max-w-3xl rounded-2xl border border-[#FF7E00]/20 bg-[#12151C]/75 px-4 py-3 text-center text-xs leading-relaxed text-white/55 sm:text-sm ${className}`}
    >
      <span className="font-black uppercase tracking-[0.12em] text-[#FF7E00]">Beta note:</span> The administrator console
      is still evolving ahead of version 1.0. Tools here may be incomplete or change as operations scale.
    </p>
  );
}

export function AdminLoadingBar({ label }: { label?: string }) {
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full w-2/5 animate-[admin-loading_1.4s_ease-in-out_infinite] rounded-full bg-[linear-gradient(90deg,#FFD34E,#FF7E00,#E32B2B,#FF7E00)]"
        />
      </div>
      {label ? <p className="text-xs text-white/50">{label}</p> : null}
    </div>
  );
}

export function AdminPrimaryButton({
  children,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`${adminPrimaryButtonClass} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export const adminNavLinkClass =
  "rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white/75 transition hover:border-[#FF7E00]/25 hover:bg-[#FF7E00]/[0.06] hover:text-[#FFD34E]";

export const adminNavLinkActiveClass =
  "rounded-lg border border-[#FF7E00]/40 bg-[#FF7E00]/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#FFD34E]";

export const adminImpersonationBannerClass =
  "mb-6 rounded-2xl border border-[#FF7E00]/35 bg-[#FF7E00]/[0.08] px-4 py-3 text-sm text-white/90 shadow-[0_12px_40px_-24px_rgba(227,43,43,0.35)]";

export function AdminStatCard({
  label,
  value,
  hint,
  accent = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: "default" | "revenue";
}) {
  const accentBar =
    accent === "revenue"
      ? "bg-gradient-to-r from-[#FFD34E] via-[#FF7E00] to-[#E32B2B]"
      : "bg-gradient-to-r from-[#FFD34E] to-[#FF7E00]";
  return (
    <div className={`${adminPanelClass} p-5`}>
      <div className={`h-1 w-12 rounded-full ${accentBar}`} aria-hidden />
      <p className={`mt-4 ${adminSectionTitleClass}`}>{label}</p>
      <p className="mt-2 text-3xl font-black tabular-nums text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-white/40">{hint}</p> : null}
    </div>
  );
}
