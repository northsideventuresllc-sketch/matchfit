"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MATCH_FIT_ROLE_DEFINITIONS, type MatchFitRoleId } from "@/lib/fp-role-definitions";

const TOOLTIP_MARGIN = 8;
const DEFAULT_TOOLTIP_WIDTH = 256;
const DEFAULT_TOOLTIP_HEIGHT = 140;

/**
 * Inline term for "Fitness Pro" / "Independent Pro" / "Elite Pro" that shows that role's
 * definition on hover or click/tap — keeps the definitions in one place (fp-role-definitions)
 * instead of repeating them inline everywhere they're mentioned.
 *
 * Hover and "pinned" (click/tap) are tracked separately so a click on an already-hovered term
 * (mouse users) doesn't immediately toggle the tooltip back closed — it stays open until the
 * term is clicked again, Escape is pressed, or the viewer clicks elsewhere. The tooltip itself
 * renders through a portal into <body> and clamps its own position to the viewport, so it can
 * never get clipped by the promo bubble's rounded/blurred/overflow-hidden container or spill
 * off the edge of a narrow (mobile) screen.
 */
export function HomeRoleDefinitionTerm({
  role,
  label,
}: {
  role: MatchFitRoleId;
  /** Display text — defaults to the role's singular label; pass e.g. "Fitness Pros" to match surrounding copy. */
  label?: string;
}) {
  const [hovering, setHovering] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const open = hovering || pinned;
  const tooltipId = useId();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const { label: defaultLabel, definition } = MATCH_FIT_ROLE_DEFINITIONS[role];

  // `open` can only become true from a user interaction, which only happens after hydration —
  // so `document` is always available by then; no separate "mounted" state/effect needed.
  const canPortal = typeof document !== "undefined";

  function showHover() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setHovering(true);
  }
  function hideHoverSoon() {
    closeTimer.current = setTimeout(() => setHovering(false), 120);
  }

  // Position the portaled tooltip relative to the trigger button, clamped to the viewport.
  useLayoutEffect(() => {
    if (!open) return;

    function reposition() {
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const tooltipWidth = tooltipRef.current?.offsetWidth ?? DEFAULT_TOOLTIP_WIDTH;
      const tooltipHeight = tooltipRef.current?.offsetHeight ?? DEFAULT_TOOLTIP_HEIGHT;

      let left = rect.left + rect.width / 2 - tooltipWidth / 2;
      left = Math.max(TOOLTIP_MARGIN, Math.min(left, window.innerWidth - tooltipWidth - TOOLTIP_MARGIN));

      let top = rect.top - tooltipHeight - TOOLTIP_MARGIN;
      if (top < TOOLTIP_MARGIN) top = rect.bottom + TOOLTIP_MARGIN;

      setCoords({ top, left });
    }

    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  // Clicking/tapping anywhere outside the term or its tooltip un-pins it.
  useEffect(() => {
    if (!pinned) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(target) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(target)
      ) {
        setPinned(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setPinned(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pinned]);

  return (
    <span ref={wrapperRef} className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        onMouseEnter={showHover}
        onMouseLeave={hideHoverSoon}
        onFocus={showHover}
        onBlur={hideHoverSoon}
        onClick={() => setPinned((v) => !v)}
        className="font-bold text-[#FFD34E] underline decoration-dotted decoration-[#FFD34E]/60 underline-offset-4 transition hover:text-[#FFE59E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7E00]/70"
      >
        {label ?? defaultLabel}
      </button>
      {open && canPortal
        ? createPortal(
            <span
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              onMouseEnter={showHover}
              onMouseLeave={hideHoverSoon}
              style={{
                position: "fixed",
                top: coords?.top ?? -9999,
                left: coords?.left ?? -9999,
                visibility: coords ? "visible" : "hidden",
              }}
              className="z-[100] w-64 max-w-[85vw] rounded-xl border border-white/15 bg-[#12151C] p-3 text-left text-xs font-normal leading-relaxed text-white/80 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)]"
            >
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#FFD34E]">
                {defaultLabel}
              </span>
              {definition}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
