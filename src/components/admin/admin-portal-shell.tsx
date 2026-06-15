"use client";

import type { ReactNode } from "react";
import { MATCH_FIT_PRODUCT_VERSION_LABEL } from "@/lib/match-fit-product-version";
import {
  adminPortalBackgroundLayers,
  adminPortalEyebrowClass,
  adminPortalMainClass,
} from "@/components/admin/admin-portal-styles";
import { AdminPortalNav, type AdminPortalNavPage } from "@/components/admin/admin-portal-nav";

const MAX_WIDTH_CLASS: Record<NonNullable<AdminPortalShellProps["maxWidth"]>, string> = {
  "3xl": "max-w-3xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  full: "max-w-[90rem]",
};

export type AdminPortalShellProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Preferred: built-in sidebar + mobile nav for this page. */
  current?: AdminPortalNavPage;
  /** Legacy: custom nav node (used when pages pass their own AdminPortalNav). */
  nav?: ReactNode;
  headerActions?: ReactNode;
  /** Alias for headerActions (legacy). */
  actions?: ReactNode;
  /** Dashboard-only: section jump list in the left rail on large screens. */
  sidebar?: ReactNode;
  footer?: ReactNode;
  maxWidth?: "3xl" | "5xl" | "6xl" | "full";
  contentClassName?: string;
};

export function AdminPortalShell(props: AdminPortalShellProps) {
  const maxWidth = props.maxWidth ?? (props.sidebar ? "full" : "6xl");
  const headerActions = props.headerActions ?? props.actions;
  const useBuiltInNav = props.current !== undefined && !props.nav;

  const sidebarNav = useBuiltInNav ? (
    <AdminPortalNav current={props.current!} variant="sidebar" />
  ) : (
    props.nav
  );

  const mobileNav = useBuiltInNav ? (
    <AdminPortalNav current={props.current!} variant="horizontal" />
  ) : (
    props.nav
  );

  const mainContent = (
    <div className={`mx-auto w-full ${MAX_WIDTH_CLASS[maxWidth]} ${props.contentClassName ?? ""}`}>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          {useBuiltInNav ? <p className={`${adminPortalEyebrowClass} lg:hidden`}>Match Fit Admin</p> : null}
          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{props.title}</h1>
          {props.description ? (
            <div className="max-w-2xl text-sm leading-relaxed text-white/55">{props.description}</div>
          ) : null}
        </div>
        {headerActions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{headerActions}</div>
        ) : null}
      </header>

      {props.children}

      {props.footer ? (
        <footer className="mt-10 border-t border-white/[0.08] pt-6 text-xs text-white/40">{props.footer}</footer>
      ) : null}
    </div>
  );

  if (!useBuiltInNav && !props.sidebar) {
    return (
      <div className={adminPortalMainClass}>
        <div aria-hidden className={adminPortalBackgroundLayers.warmGlow} />
        <div aria-hidden className={adminPortalBackgroundLayers.topAccent} />
        <div aria-hidden className={adminPortalBackgroundLayers.vignette} />
        <div className="relative z-10 px-5 py-8 sm:px-8 sm:py-10">{mainContent}</div>
      </div>
    );
  }

  return (
    <div className={adminPortalMainClass}>
      <div aria-hidden className={adminPortalBackgroundLayers.warmGlow} />
      <div aria-hidden className={adminPortalBackgroundLayers.topAccent} />
      <div aria-hidden className={adminPortalBackgroundLayers.vignette} />

      <div className="relative z-10 mx-auto flex w-full max-w-[90rem] items-start">
        <aside className="hidden w-56 shrink-0 self-start border-r border-white/[0.06] bg-[#0B0C0F]/80 lg:block xl:w-60">
          <div className="sticky top-0 flex max-h-svh flex-col gap-6 overflow-y-auto overscroll-y-contain px-4 py-8">
            {useBuiltInNav ? (
              <div>
                <p className={adminPortalEyebrowClass}>Match Fit</p>
                <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/35">
                  v{MATCH_FIT_PRODUCT_VERSION_LABEL}
                </p>
                <p className="mt-3 text-sm font-black text-white/90">Admin Portal</p>
              </div>
            ) : null}
            {sidebarNav}
            {props.sidebar ? <div className="border-t border-white/[0.06] pt-4">{props.sidebar}</div> : null}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-white/[0.06] bg-[#0B0C0F]/90 px-5 py-4 backdrop-blur-md lg:hidden">
            {mobileNav}
          </div>

          <div className="flex-1 px-5 py-8 sm:px-8 sm:py-10">{mainContent}</div>
        </div>
      </div>
    </div>
  );
}
